# DevLoadingView host invalidation reproduction

This branch adds an RNTester reproduction for an iOS development loading banner that survives destruction of its React Native host. It is based on main commit `27e77216ef2557ccbf31a01067a44dc1dd2ec846`; the React Native framework source is unchanged, so this branch reproduces the bug before the fix.

Validated with Xcode 27.0, an iPhone 18 Pro simulator running iOS 27.0, and a Debug build.

## Setup

Use a separate checkout for the reproduction:

```bash
git clone --single-branch --branch repro/devloadingview-invalidation \
  https://github.com/fairysword/react-native.git react-native-devloading-repro
cd react-native-devloading-repro
yarn install
yarn --cwd packages/react-native-codegen build
cd packages/rn-tester
bundle install
bundle exec pod update hermes-engine --no-repo-update
cd ../..
```

On this baseline, the checked-in RNTester lockfile references an older Hermes version than the local podspec. The targeted pod update aligns the installed dependencies before building. Run Bundler in `packages/rn-tester` so it uses RNTester's Gemfile.

## Start Metro and the delay proxy

In the first terminal, from the repository root:

```bash
yarn start --port 8081 --max-workers 4
```

In a second terminal, from the same repository root:

```bash
node packages/rn-tester/devloading-invalidation/slow-metro.cjs
```

The proxy listens on port 8082 and delays bundle requests by six seconds before forwarding them to Metro on port 8081. The bundle is the real RNTester JavaScript bundle.

## Run in Xcode

Open `packages/rn-tester/RNTesterPods.xcworkspace`, select the **RNTester** scheme and an iOS simulator, then Run in **Debug**.

The shared scheme already sets:

- Environment variable: `DEV_LOADING_REPRO=manual`.
- Launch argument: `-RCT_jsLocation localhost:8082`.

The app opens a native screen with **Open RN page** and **Close RN page and release Host** buttons. Manual mode does not open or close the page automatically.

## Reproduce

1. Tap **Open RN page** to create a new React Native factory and host and start loading RNTester.
2. Wait for **Loading from Metro…** to appear.
3. Before the six-second bundle delay expires, tap **Close RN page and release Host**. This removes the RN view and releases the factory's host and the factory itself.
4. Wait at least ten seconds after closing.

**Expected:** the loading banner is removed during host teardown and does not appear again for the destroyed host.

**Actual on this branch:** the RN page is closed and the weak reference to its host is nil, but the banner remains over the native screen.

The controls are placed in a separate native window above the loading window to keep the buttons tappable. This does not modify DevLoadingView or bypass host invalidation. The reproduction never calls DevLoadingView's show, hide, or invalidate methods.

The status text is a snapshot captured when a button is pressed. Host/module cleanup is asynchronous, so judge the banner after teardown rather than treating that snapshot as a live counter.

## Verify the fix

Apply the proposed `RCTDevLoadingView.mm` change to this checkout, rebuild, restart the app, and repeat the same manual steps. The old banner should clear during invalidation and should not reappear after the delayed request finishes.

Then tap **Open RN page** again and keep it open until loading finishes. The new host should display its loading banner, show the RNTester content, and clear the banner normally.

Restart the app between baseline and patched runs so no banner from a previous process affects the result.

## Optional lifecycle scenarios

To exercise timing cases, change `DEV_LOADING_REPRO` in **Edit Scheme → Run → Arguments** and restart the app for each scenario:

| Value | Behavior |
| --- | --- |
| `manual` | Open and close only through the buttons. |
| `visible` | Open, then release the host after one second while the banner is visible. |
| `early` | Open, then release the host after about 50 ms, before the initial 200 ms banner delay. |
| `normal` | Keep the host alive for normal bundle completion, then close after ten seconds. |
| `reopen` | Close during loading, reopen with a new host after three seconds, and close again after thirteen seconds. |

The scripted modes log `[DevLoadingRepro]` observations to the Xcode console and save `devloading-result.json` in the app's Documents directory. Each observation includes whether the RN view is open, whether a weak reference to the closed host remains alive, and the visible loading banners. The `normal` and `reopen` modes use fixed delays; ensure Metro is ready so the bundle finishes before their scheduled close.

Recorded results with the six-second proxy delay:

| Scenario | Baseline | With the fix |
| --- | --- | --- |
| Close while the banner is visible | Banner remains after the host is released | Banner clears |
| Close before the initial banner delay | Banner appears after the host is released | Banner stays absent |
| Allow normal loading | Not separately recorded | RNTester loads and the banner clears |
| Close and reopen with a new host | Not separately recorded | Old banner clears; the new host loads normally |
