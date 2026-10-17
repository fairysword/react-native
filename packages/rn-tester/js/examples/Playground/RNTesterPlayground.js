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
import type {ImageSourcePropType} from 'react-native';

import RNTesterButton from '../../components/RNTesterButton';
import RNTesterText from '../../components/RNTesterText';
import * as React from 'react';
import {useEffect, useState} from 'react';
import {Image, ScrollView, StyleSheet, View} from 'react-native';

const AVATAR_IMAGES: $ReadOnlyArray<ImageSourcePropType> = [
  require('../../assets/bunny.png'),
  require('../../assets/flowers.png'),
  require('../../assets/flux.png'),
  require('../../assets/hawk.png'),
  require('../../assets/imageMask.png'),
  require('../../assets/party.png'),
  require('../../assets/rainbow.jpeg'),
  require('../../assets/relay.png'),
];

const IMAGE: ImageSourcePropType = {uri: 'legacy_image'};
const IMAGE_RELOAD: ImageSourcePropType = {
  uri: 'legacy_image',
  cache: 'reload',
};
const ROWS = 4;
const FOLLOW_UP_ROWS = 20;

type Stage = 'idle' | 'mount' | 'followUp';

function Playground(): React.Node {
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');

  useEffect(() => {
    const timer = setTimeout(() => setStage('mount'), 1000);
    return () => clearTimeout(timer);
  }, [run]);

  useEffect(() => {
    if (stage === 'mount') {
      setStage('followUp');
    }
  }, [stage]);

  const mounted = stage !== 'idle';
  return (
    <View style={styles.screen}>
      <RNTesterText style={styles.caption}>
        A and B use the same image and mount in the same commit. A starts with a
        cold request, while B mounts later and finds A&apos;s decoded image in
        the memory cache. The bug draws A&apos;s gray placeholder for one or
        more frames while B already shows the image.
      </RNTesterText>
      <RNTesterButton
        onPress={() => {
          setStage('idle');
          setRun(value => value + 1);
        }}>
        Run again
      </RNTesterButton>
      <View style={styles.stage}>
        <View collapsable={false} style={[styles.slot, styles.slotA]}>
          {mounted ? <ImageButton label="A" source={IMAGE_RELOAD} /> : null}
        </View>
        <ScrollView
          collapsable={false}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={false}
          style={styles.list}>
          {mounted ? (
            <Rows count={ROWS} keyPrefix="row" startIndex={0} />
          ) : null}
          {stage === 'followUp' ? (
            <Rows
              count={FOLLOW_UP_ROWS}
              keyPrefix="followUp"
              startIndex={ROWS}
            />
          ) : null}
        </ScrollView>
        <View collapsable={false} style={[styles.slot, styles.slotB]}>
          {mounted ? <ImageButton label="B" source={IMAGE} /> : null}
        </View>
      </View>
    </View>
  );
}

function ImageButton({
  label,
  source,
}: {
  label: string,
  source: ImageSourcePropType,
}): React.Node {
  return (
    <View style={styles.button}>
      <Image
        fadeDuration={0}
        resizeMode="contain"
        source={source}
        style={styles.image}
      />
      <RNTesterText style={styles.buttonLabel}>{label}</RNTesterText>
    </View>
  );
}

function Rows({
  count,
  keyPrefix,
  startIndex,
}: {
  count: number,
  keyPrefix: string,
  startIndex: number,
}): React.Node {
  return Array.from({length: count}, (_, index) => {
    const displayIndex = startIndex + index;
    return (
      <View
        collapsable={false}
        key={`${keyPrefix}-${index}`}
        style={styles.row}>
        <View collapsable={false} style={styles.rankContainer}>
          <RNTesterText style={styles.rank}>{displayIndex + 1}</RNTesterText>
        </View>
        <View collapsable={false} style={styles.avatarContainer}>
          <Image
            fadeDuration={0}
            resizeMode="cover"
            source={AVATAR_IMAGES[displayIndex % AVATAR_IMAGES.length]}
            style={styles.avatar}
          />
          <View style={styles.onlineDot} />
        </View>
        <View collapsable={false} style={styles.rowContent}>
          <View collapsable={false} style={styles.titleLine}>
            <RNTesterText numberOfLines={1} style={styles.title}>
              {`Candidate ${displayIndex + 1}`}
            </RNTesterText>
            <View style={styles.badge}>
              <RNTesterText style={styles.badgeText}>LIVE</RNTesterText>
            </View>
          </View>
          <View collapsable={false} style={styles.metaLine}>
            <RNTesterText
              style={
                styles.subtitle
              }>{`Level ${(displayIndex % 30) + 1}`}</RNTesterText>
            <View style={styles.metaSeparator} />
            <RNTesterText
              style={
                styles.subtitle
              }>{`${(displayIndex * 13) % 500} supporters`}</RNTesterText>
          </View>
          <View collapsable={false} style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {width: 12 + ((displayIndex * 37) % 84)},
              ]}
            />
          </View>
        </View>
        <View collapsable={false} style={styles.action}>
          <View collapsable={false} style={styles.rowButton}>
            <RNTesterText style={styles.rowButtonText}>Vote</RNTesterText>
          </View>
        </View>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  caption: {
    padding: 8,
  },
  stage: {
    flex: 1,
    overflow: 'hidden',
  },
  slot: {
    height: 48,
    left: 16,
    position: 'absolute',
    right: 16,
  },
  slotA: {
    top: 8,
  },
  slotB: {
    top: 64,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#8a8a8a',
    borderRadius: 4,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    position: 'absolute',
    width: '100%',
  },
  buttonLabel: {
    color: 'white',
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
    marginTop: 120,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    alignItems: 'center',
    backgroundColor: '#f2f4f7',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 8,
  },
  rankContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  rank: {
    fontSize: 12,
    fontWeight: '600',
  },
  avatarContainer: {
    height: 42,
    width: 42,
  },
  avatar: {
    backgroundColor: '#b7c0cc',
    borderRadius: 21,
    height: 42,
    width: 42,
  },
  onlineDot: {
    backgroundColor: '#26a269',
    borderColor: '#f2f4f7',
    borderRadius: 6,
    borderWidth: 2,
    bottom: 0,
    height: 12,
    position: 'absolute',
    right: 0,
    width: 12,
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  titleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  title: {
    flex: 1,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#fff0e6',
    borderColor: '#e1660d',
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    color: '#b54f08',
    fontSize: 8,
    fontWeight: '700',
  },
  metaLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  subtitle: {
    color: '#5b6573',
    fontSize: 10,
  },
  metaSeparator: {
    backgroundColor: '#9aa3ad',
    borderRadius: 2,
    height: 3,
    width: 3,
  },
  progressTrack: {
    backgroundColor: '#d7dce2',
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
    width: 96,
  },
  progressFill: {
    backgroundColor: '#e1660d',
    borderRadius: 2,
    height: 4,
  },
  action: {
    alignItems: 'center',
  },
  rowButton: {
    alignItems: 'center',
    backgroundColor: '#e1660d',
    borderRadius: 4,
    height: 26,
    justifyContent: 'center',
    width: 58,
  },
  rowButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default {
  title: 'Image decoded during a long frame',
  name: 'image-ready-during-long-frame',
  description:
    'Reproduces an Android image result that is ready before draw but delivered after later frames.',
  render: (): React.Node => <Playground />,
} as RNTesterModuleExample;
