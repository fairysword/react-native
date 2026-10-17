/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.facebook.react.views.image

import android.content.res.Resources
import android.os.Looper
import android.view.View
import android.view.ViewTreeObserver
import androidx.annotation.UiThread
import com.facebook.cache.common.CacheKey
import com.facebook.common.internal.ImmutableList
import com.facebook.drawee.backends.pipeline.PipelineDraweeController
import com.facebook.drawee.backends.pipeline.PipelineDraweeControllerFactory
import com.facebook.drawee.components.DeferredReleaser
import com.facebook.drawee.interfaces.DraweeController
import com.facebook.imagepipeline.cache.MemoryCache
import com.facebook.imagepipeline.drawable.DrawableFactory
import com.facebook.imagepipeline.image.CloseableImage
import java.util.WeakHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.Executor

/**
 * Applies image results that Fresco produced on a background thread before the next draw.
 *
 * Fresco hands such results to the UI thread with a Handler message. When the UI thread is in the
 * middle of a long frame (for example a large mount), a result that becomes ready well before that
 * frame draws is only applied after it, so the frame shows the placeholder. If the next vsync is
 * already due when the result is posted, that frame also runs before the message.
 *
 * Only controllers passed to [enableFor] take part; other Fresco users keep the original delivery.
 * Their results are still posted as before. They are also queued here and applied from the window's
 * pre-draw pass if that comes first. Each result runs once, in posting order; whichever path
 * reaches it second does nothing.
 */
internal object ImageDeliveryBeforeDraw {
  private val pending = ConcurrentLinkedQueue<PendingResult>()
  private val postLock = Any()
  private val hookedObservers = WeakHashMap<ViewTreeObserver, Unit>()
  private var delivering = false
  private val preDrawListener =
      ViewTreeObserver.OnPreDrawListener {
        deliverPending()
        true
      }

  /** Lets the background results of [controller] be applied before the next draw. */
  @UiThread
  fun enableFor(controller: DraweeController?) {
    (controller as? Controller)?.resultExecutor?.enabled = true
  }

  /** Installs the pre-draw hook on the window of [view], once per window. */
  @UiThread
  fun ensurePreDrawHook(view: View) {
    val observer = view.viewTreeObserver
    if (!observer.isAlive || hookedObservers.containsKey(observer)) {
      return
    }
    observer.addOnPreDrawListener(preDrawListener)
    hookedObservers[observer] = Unit
  }

  /** Runs the results that are already posted but not yet delivered. Returns how many ran. */
  @UiThread
  fun deliverPending(): Int {
    if (delivering || pending.isEmpty()) {
      return 0
    }
    delivering = true
    try {
      var delivered = 0
      for (result in pending.toTypedArray()) {
        if (result.runBeforeDraw()) {
          delivered++
        }
      }
      return delivered
    } finally {
      delivering = false
    }
  }

  /** Wraps the UI-thread executor that a Fresco controller uses for data source callbacks. */
  internal class ResultExecutor(private val uiThreadExecutor: Executor) : Executor {
    @Volatile var enabled = false

    override fun execute(command: Runnable) {
      if (!enabled || Looper.myLooper() == Looper.getMainLooper()) {
        uiThreadExecutor.execute(command)
        return
      }
      val result = PendingResult(command)
      // Keeps the pre-draw queue in the same order as the posted messages.
      synchronized(postLock) {
        pending.add(result)
        try {
          uiThreadExecutor.execute(result)
        } catch (e: RuntimeException) {
          pending.remove(result)
          throw e
        }
      }
    }
  }

  internal class Controller(
      resources: Resources,
      deferredReleaser: DeferredReleaser,
      animatedDrawableFactory: DrawableFactory?,
      xmlDrawableFactory: DrawableFactory?,
      val resultExecutor: ResultExecutor,
      memoryCache: MemoryCache<CacheKey, CloseableImage>?,
      drawableFactories: ImmutableList<DrawableFactory>?,
  ) :
      PipelineDraweeController(
          resources,
          deferredReleaser,
          animatedDrawableFactory,
          xmlDrawableFactory,
          resultExecutor,
          memoryCache,
          drawableFactories,
      )

  private class PendingResult(private var command: Runnable?) : Runnable {
    private var deferredFailure: RuntimeException? = null

    override fun run() {
      deferredFailure?.let {
        deferredFailure = null
        throw it
      }
      runOnce()
    }

    /** A failure is rethrown from the posted message, so it does not interrupt the draw. */
    @UiThread
    fun runBeforeDraw(): Boolean {
      if (command == null) {
        return false
      }
      try {
        runOnce()
      } catch (e: RuntimeException) {
        deferredFailure = e
      }
      return true
    }

    @UiThread
    private fun runOnce() {
      val current = command ?: return
      command = null
      pending.remove(this)
      current.run()
    }
  }
}

/** Creates Fresco controllers whose background results can be applied before the next draw. */
internal class ImageDeliveryBeforeDrawControllerFactory : PipelineDraweeControllerFactory() {
  override fun internalCreateController(
      resources: Resources,
      deferredReleaser: DeferredReleaser,
      animatedDrawableFactory: DrawableFactory?,
      xmlDrawableFactory: DrawableFactory?,
      uiThreadExecutor: Executor,
      memoryCache: MemoryCache<CacheKey, CloseableImage>?,
      drawableFactories: ImmutableList<DrawableFactory>?,
  ): PipelineDraweeController =
      ImageDeliveryBeforeDraw.Controller(
          resources,
          deferredReleaser,
          animatedDrawableFactory,
          xmlDrawableFactory,
          ImageDeliveryBeforeDraw.ResultExecutor(uiThreadExecutor),
          memoryCache,
          drawableFactories,
      )
}
