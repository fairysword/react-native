/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.facebook.react.views.image

import android.view.View
import java.util.Collections
import kotlin.concurrent.thread
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

@RunWith(RobolectricTestRunner::class)
class ImageDeliveryBeforeDrawTest {
  private val posted = Collections.synchronizedList(mutableListOf<Runnable>())
  private val executor = ImageDeliveryBeforeDraw.ResultExecutor { posted.add(it) }
  private val calls = Collections.synchronizedList(mutableListOf<String>())

  @Before
  fun setUp() {
    executor.enabled = true
  }

  @After
  fun tearDown() {
    ImageDeliveryBeforeDraw.deliverPending()
  }

  @Test
  fun resultsOfControllersThatAreNotEnabledGoStraightToTheUiThreadExecutor() {
    executor.enabled = false
    postFromBackground("a")

    assertThat(ImageDeliveryBeforeDraw.deliverPending()).isEqualTo(0)
    assertThat(calls).isEmpty()
    posted.single().run()
    assertThat(calls).containsExactly("a")
  }

  @Test
  fun uiThreadResultsGoStraightToTheUiThreadExecutor() {
    executor.execute { calls.add("a") }

    assertThat(posted).hasSize(1)
    assertThat(ImageDeliveryBeforeDraw.deliverPending()).isEqualTo(0)
    assertThat(calls).isEmpty()
  }

  @Test
  fun backgroundResultRunsOnceWhenPreDrawComesFirst() {
    postFromBackground("a")

    assertThat(posted).hasSize(1)
    assertThat(calls).isEmpty()
    assertThat(ImageDeliveryBeforeDraw.deliverPending()).isEqualTo(1)
    assertThat(calls).containsExactly("a")

    posted.single().run()
    assertThat(calls).containsExactly("a")
  }

  @Test
  fun backgroundResultRunsOnceWhenThePostedMessageComesFirst() {
    postFromBackground("a")

    posted.single().run()
    assertThat(calls).containsExactly("a")
    assertThat(ImageDeliveryBeforeDraw.deliverPending()).isEqualTo(0)
    assertThat(calls).containsExactly("a")
  }

  @Test
  fun preDrawKeepsPostingOrderAndSkipsDeliveredResults() {
    postFromBackground("a")
    postFromBackground("b")
    postFromBackground("c")

    posted[1].run()
    assertThat(ImageDeliveryBeforeDraw.deliverPending()).isEqualTo(2)
    assertThat(calls).containsExactly("b", "a", "c")
  }

  @Test
  fun failureBeforeDrawIsRethrownFromThePostedMessage() {
    val failure = IllegalStateException("boom")
    thread { executor.execute { throw failure } }.join()
    postFromBackground("b")

    assertThat(ImageDeliveryBeforeDraw.deliverPending()).isEqualTo(2)
    assertThat(calls).containsExactly("b")
    assertThatThrownBy { posted[0].run() }.isSameAs(failure)
    posted[0].run()
    posted[1].run()
    assertThat(calls).containsExactly("b")
  }

  @Test
  fun preDrawHookDeliversPendingResults() {
    val view = View(RuntimeEnvironment.getApplication())
    ImageDeliveryBeforeDraw.ensurePreDrawHook(view)
    ImageDeliveryBeforeDraw.ensurePreDrawHook(view)
    postFromBackground("a")

    assertThat(view.viewTreeObserver.dispatchOnPreDraw()).isFalse()
    assertThat(calls).containsExactly("a")
  }

  private fun postFromBackground(name: String) {
    thread { executor.execute { calls.add(name) } }.join()
  }
}
