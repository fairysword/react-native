#import <ReactCommon/RCTHost.h>
#import <RCTRootViewFactory.h>
#import <QuartzCore/QuartzCore.h>

// Keep the local controls above DevLoadingView without changing its window.
@interface DevLoadingReproControlsWindow : UIWindow
@end

@implementation DevLoadingReproControlsWindow
- (UIView *)hitTest:(CGPoint)point withEvent:(UIEvent *)event
{
  UIView *hitView = [super hitTest:point withEvent:event];
  if (hitView == self || hitView == self.rootViewController.view) {
    return nil;
  }
  return hitView;
}
@end

// Local reproduction: only public factory/host ownership and real bundle loading.
// No calls to DevLoadingView's show, hide, invalidate, or private methods.
@interface DevLoadingReproController : UIViewController
@property (nonatomic, weak) SceneDelegate *sceneDelegate;
@property (nonatomic, strong) UIView *reactView;
@property (nonatomic, strong) DevLoadingReproControlsWindow *controlsWindow;
@property (nonatomic, strong) UILabel *status;
@property (nonatomic, weak) RCTHost *closedHost;
@property (nonatomic, strong) NSMutableArray *observations;
@property (nonatomic, copy) NSString *scenario;
@property (nonatomic, assign) CFTimeInterval startedAt;
@end

static void CollectReproLabels(UIView *view, NSMutableArray *labels)
{
  if ([view isKindOfClass:UILabel.class] && ((UILabel *)view).text.length) {
    [labels addObject:((UILabel *)view).text];
  }
  for (UIView *child in view.subviews) {
    CollectReproLabels(child, labels);
  }
}

@implementation DevLoadingReproController
- (void)viewDidLoad
{
  [super viewDidLoad];
  self.view.backgroundColor = UIColor.systemBackgroundColor;
  self.startedAt = CACurrentMediaTime();
  self.observations = [NSMutableArray new];
  self.scenario = NSProcessInfo.processInfo.environment[@"DEV_LOADING_REPRO"];
  UILabel *title = [UILabel new];
  title.text = @"DevLoadingView · Host lifetime";
  title.font = [UIFont boldSystemFontOfSize:22];
  title.numberOfLines = 0;
  self.status = [UILabel new];
  self.status.numberOfLines = 0;
  self.status.font = [UIFont monospacedSystemFontOfSize:14 weight:UIFontWeightRegular];
  self.status.text = @"Native page. Open RN, then close it while Metro is loading.";
  UIButton *open = [UIButton buttonWithType:UIButtonTypeSystem];
  [open setTitle:@"Open RN page" forState:UIControlStateNormal];
  [open addTarget:self action:@selector(openRN) forControlEvents:UIControlEventTouchUpInside];
  UIButton *close = [UIButton buttonWithType:UIButtonTypeSystem];
  [close setTitle:@"Close RN page and release Host" forState:UIControlStateNormal];
  [close addTarget:self action:@selector(closeRN) forControlEvents:UIControlEventTouchUpInside];
  UIStackView *controls = [[UIStackView alloc] initWithArrangedSubviews:@[title, open, close, self.status]];
  controls.axis = UILayoutConstraintAxisVertical;
  controls.spacing = 14;
  controls.translatesAutoresizingMaskIntoConstraints = NO;
  UIView *controlsRoot = self.controlsWindow.rootViewController.view;
  [controlsRoot addSubview:controls];
  [NSLayoutConstraint activateConstraints:@[
    [controls.topAnchor constraintEqualToAnchor:controlsRoot.safeAreaLayoutGuide.topAnchor constant:40],
    [controls.leadingAnchor constraintEqualToAnchor:controlsRoot.leadingAnchor constant:20],
    [controls.trailingAnchor constraintEqualToAnchor:controlsRoot.trailingAnchor constant:-20]
  ]];
  if (![self.scenario isEqualToString:@"manual"]) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC), dispatch_get_main_queue(), ^{
      [self runScenario];
    });
  }
}

- (void)openRN
{
  if (self.reactView != nil) {
    return;
  }
  self.sceneDelegate.reactNativeFactory = [[RCTReactNativeFactory alloc] initWithDelegate:self.sceneDelegate];
  self.reactView = [self.sceneDelegate.reactNativeFactory.rootViewFactory viewWithModuleName:@"RNTesterApp"];
  self.reactView.frame = CGRectMake(0, 360, self.view.bounds.size.width, self.view.bounds.size.height - 360);
  self.reactView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [self.view addSubview:self.reactView];
  [self record:@"opened"];
}

- (void)closeRN
{
  self.closedHost = self.sceneDelegate.reactNativeFactory.rootViewFactory.reactHost;
  [self.reactView removeFromSuperview];
  self.reactView = nil;
  self.sceneDelegate.reactNativeFactory.rootViewFactory.reactHost = nil;
  self.sceneDelegate.reactNativeFactory = nil;
  [self record:@"closed"];
}

- (void)record:(NSString *)event
{
  NSMutableArray *banners = [NSMutableArray new];
  for (UIWindow *window in self.view.window.windowScene.windows) {
    if (!window.hidden && window.windowLevel > UIWindowLevelNormal) {
      NSMutableArray *labels = [NSMutableArray new];
      CollectReproLabels(window, labels);
      for (NSString *label in labels) {
        if ([label containsString:@"Loading from"] || [label containsString:@"Downloading"]) {
          [banners addObject:label];
        }
      }
    }
  }
  NSDictionary *observation = @{
    @"event": event,
    @"seconds": @(CACurrentMediaTime() - self.startedAt),
    @"rnPageOpen": @(self.reactView != nil),
    @"closedHostAlive": @(self.closedHost != nil),
    @"visibleBanners": banners
  };
  [self.observations addObject:observation];
  self.status.text = [NSString stringWithFormat:@"%@\nRN page: %@\nClosed Host alive: %@\nVisible loading banners: %lu",
                        event, self.reactView ? @"open" : @"closed", self.closedHost ? @"YES" : @"NO",
                        (unsigned long)banners.count];
  NSString *documents = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
  NSData *data = [NSJSONSerialization dataWithJSONObject:@{@"scenario": self.scenario, @"observations": self.observations}
                                               options:NSJSONWritingPrettyPrinted error:nil];
  [data writeToFile:[documents stringByAppendingPathComponent:@"devloading-result.json"] atomically:YES];
  NSLog(@"[DevLoadingRepro] %@", observation);
}

- (void)runScenario
{
  [self openRN];
  BOOL normal = [self.scenario isEqualToString:@"normal"];
  BOOL reopen = [self.scenario isEqualToString:@"reopen"];
  if (!normal) {
    double closeDelay = [self.scenario isEqualToString:@"early"] ? 0.05 : 1.0;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(closeDelay * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [self record:@"before-close"];
      [self closeRN];
    });
  }
  NSArray *checkpoints = reopen ? @[@0.5, @2.0, @8.0, @11.0, @15.0] : @[@0.5, @2.0, @8.0, @11.0];
  for (NSNumber *delay in checkpoints) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(delay.doubleValue * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
      [self record:[NSString stringWithFormat:@"after-%@s", delay]];
    });
  }
  if (reopen) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 3 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{ [self openRN]; });
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 4 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{ [self record:@"reopened-loading"]; });
  }
  if (normal || reopen) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (reopen ? 13 : 10) * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
      [self record:@"loaded-before-close"];
      [self closeRN];
    });
  }
}
@end

static BOOL RCTStartDevLoadingInvalidationRepro(SceneDelegate *delegate, UIWindowScene *scene)
{
  if (!NSProcessInfo.processInfo.environment[@"DEV_LOADING_REPRO"].length) {
    return NO;
  }
  DevLoadingReproController *controller = [DevLoadingReproController new];
  controller.sceneDelegate = delegate;
  controller.controlsWindow = [[DevLoadingReproControlsWindow alloc] initWithWindowScene:scene];
  controller.controlsWindow.frame = scene.coordinateSpace.bounds;
  controller.controlsWindow.windowLevel = UIWindowLevelStatusBar + 2;
  controller.controlsWindow.rootViewController = [UIViewController new];
  controller.controlsWindow.rootViewController.view.backgroundColor = UIColor.clearColor;
  delegate.window = [[UIWindow alloc] initWithWindowScene:scene];
  delegate.window.rootViewController = controller;
  [delegate.window makeKeyAndVisible];
  controller.controlsWindow.hidden = NO;
  return YES;
}
