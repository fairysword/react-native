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

import * as React from 'react';
import {Button, Modal, StyleSheet, Text, View} from 'react-native';

function Playground() {
  const [visible, setVisible] = React.useState(false);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dark app, light system theme</Text>
      <Text style={styles.text}>
        Keep the system in light mode with 3-button navigation. The app draws a
        black navigation bar with light buttons. Opening the modal below should
        leave the navigation bar unchanged.
      </Text>
      <Button title="Open modal" onPress={() => setVisible(true)} />
      <Modal
        visible={visible}
        transparent
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}>
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Rules</Text>
            <Text style={styles.text}>
              A transparent bottom sheet Modal. The navigation bar should stay
              black with light buttons.
            </Text>
            <Button title="Close modal" onPress={() => setVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: '#202020',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  text: {
    color: 'white',
    fontSize: 16,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#00000099',
  },
  sheet: {
    padding: 24,
    paddingBottom: 64,
    gap: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#131313',
  },
});

export default {
  title: 'Playground',
  name: 'playground',
  description: 'A transparent Modal changes a dark app navigation bar.',
  render: (): React.Node => <Playground />,
} as RNTesterModuleExample;
