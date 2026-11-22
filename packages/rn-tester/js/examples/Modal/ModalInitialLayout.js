/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {RNTesterModuleExample} from '../../types/RNTesterTypes';
import type {LayoutChangeEvent} from 'react-native';

import RNTesterText from '../../components/RNTesterText';
import {RNTesterThemeContext} from '../../components/RNTesterTheme';
import * as React from 'react';
import {useContext, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Button,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

function Sheet({onClose}: {onClose: () => void}): React.Node {
  const theme = useContext(RNTesterThemeContext);
  const {height} = useWindowDimensions();
  const offset = useRef(new Animated.Value(height)).current;
  useEffect(() => {
    const animation = Animated.timing(offset, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [offset]);

  // Log without setState so instrumentation does not schedule extra layouts.
  const logLayout = (name: string, event: LayoutChangeEvent) => {
    console.log(
      '[ModalInitialLayout]',
      name,
      Date.now(),
      event.nativeEvent.layout,
    );
  };
  return (
    <View style={styles.backdrop} onLayout={event => logLayout('root', event)}>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.BackgroundColor,
            borderColor: theme.SeparatorColor,
          },
          {transform: [{translateY: offset}]},
        ]}
        onLayout={event => logLayout('sheet', event)}>
        <RNTesterText style={styles.title}>Modal content</RNTesterText>
        <Button title="Close" onPress={onClose} />
        <ScrollView style={styles.scroll}>
          {Array.from({length: 12}, (_, index) => (
            <RNTesterText key={index} style={styles.rule}>
              Item {index + 1}. This is static sample content inside a
              scrollable bottom sheet. No network request or safe area padding
              is used.
            </RNTesterText>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function ModalInitialLayout(): React.Node {
  const [translucent, setTranslucent] = useState(true);
  const [navigationTranslucent, setNavigationTranslucent] = useState(false);
  const [visible, setVisible] = useState(false);
  const open = (value: boolean, navigation: boolean = false) => {
    setNavigationTranslucent(navigation);
    setTranslucent(value);
    setVisible(true);
  };
  return (
    <View>
      <RNTesterText>
        Open repeatedly and watch the top edge and bottom of the backdrop.
        Compare root/sheet onLayout events in the console. For system bar
        translucency, choose status bar only, neither bar, or both bars, in that
        order. The values below each button are the requested Modal props.
      </RNTesterText>
      <Button title="Status bar only" onPress={() => open(true)} />
      <RNTesterText style={styles.optionDescription}>
        statusBarTranslucent=true{'\n'}
        navigationBarTranslucent=false
      </RNTesterText>
      <Button title="Neither bar" onPress={() => open(false)} />
      <RNTesterText style={styles.optionDescription}>
        statusBarTranslucent=false{'\n'}
        navigationBarTranslucent=false
      </RNTesterText>
      <Button title="Both bars" onPress={() => open(true, true)} />
      <RNTesterText style={styles.optionDescription}>
        statusBarTranslucent=true{'\n'}
        navigationBarTranslucent=true
      </RNTesterText>
      {visible && (
        <Modal
          transparent
          statusBarTranslucent={translucent}
          navigationBarTranslucent={navigationTranslucent}
          animationType="none"
          onShow={() =>
            console.log('[ModalInitialLayout]', 'onShow', Date.now())
          }
          onRequestClose={() => setVisible(false)}>
          <Sheet onClose={() => setVisible(false)} />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  optionDescription: {
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    maxHeight: '60%',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
  },
  scroll: {flexShrink: 1},
  title: {fontSize: 24, fontWeight: 'bold'},
  rule: {fontSize: 18, marginVertical: 16},
});

export default {
  title: 'Modal initial bottom sheet layout',
  name: 'initial-layout',
  description: 'Android: initial root size versus the measured Dialog size.',
  platform: 'android',
  render: (): React.Node => <ModalInitialLayout />,
} as RNTesterModuleExample;
