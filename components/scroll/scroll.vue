<template>
  <div
    ref="wrapper"
    :class="className"
    :style="style"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
    @wheel.exact="handleWheel($event, 'vertical')"
    @wheel.shift="handleWheel($event, 'horizontal')"
  >
    <div
      ref="content"
      :class="wrapperClass"
      :style="wrapperStyle"
      @transitionend="transitionDuration = -1"
    >
      <slot></slot>
    </div>
    <Scrollbar
      v-if="useXBar"
      placement="bottom"
      :class="barClass"
      :scroll="percentX"
      :fade="barFade"
      :bar-length="xBarLength"
      :disabled="!enableXScroll"
      :duration="transitionDuration"
      @on-scroll-start="handleBarScrollStart('horizontal')"
      @on-scroll="handleXBarScroll"
      @on-scroll-end="handleBarScrollEnd('horizontal')"
    ></Scrollbar>
    <Scrollbar
      v-if="useYBar"
      placement="right"
      :class="barClass"
      :scroll="percentY"
      :fade="barFade"
      :bar-length="yBarLength"
      :disabled="!enableYScroll"
      :duration="transitionDuration"
      @on-scroll-start="handleBarScrollStart('vertical')"
      @on-scroll="handleYBarScroll"
      @on-scroll-end="handleBarScrollEnd('vertical')"
    ></Scrollbar>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, toRef, nextTick } from 'vue'
import { Scrollbar } from '@/components/scrollbar'
import { useConfiguredProps } from '@/common/config/install'
import { isTrue } from '@/common/utils/common'
import { USE_TOUCH } from '@/common/utils/dom-event'
import { createEventEmitter } from '@/common/utils/event-emitter'
import { useScrollWrapper } from './mixins'

import type { PropType } from 'vue'
import type { EventHandler } from '@/common/utils/event-emitter'
import type { ScrollMode, ClassType } from './symbol'

const moveEvent = USE_TOUCH ? 'touchmove' : 'mousemove'
const upEvent = USE_TOUCH ? 'touchend' : 'mouseup'

const props = useConfiguredProps('scroll', {
  scrollClass: {
    type: [String, Object] as PropType<ClassType>,
    default: null
  },
  mode: {
    default: 'vertical' as ScrollMode,
    validator: (value: ScrollMode) => {
      return ['horizontal', 'vertical', 'both'].includes(value)
    }
  },
  width: {
    type: [Number, String],
    default: ''
  },
  height: {
    type: [Number, String],
    default: ''
  },
  deltaX: {
    type: Number,
    default: 20
  },
  deltaY: {
    type: Number,
    default: 20
  },
  disabled: {
    type: Boolean,
    default: false
  },
  pointer: {
    type: Boolean,
    default: false
  },
  wheel: {
    type: Boolean,
    default: true
  },
  scrollX: {
    type: Number,
    default: 0
  },
  scrollY: {
    type: Number,
    default: 0
  },
  useXBar: {
    type: Boolean,
    default: false
  },
  useYBar: {
    type: Boolean,
    default: false
  },
  barFade: {
    type: Number,
    default: 1500
  },
  barClass: {
    type: [String, Object] as PropType<ClassType>,
    default: null
  },
  autoplay: {
    type: [Boolean, Number],
    default: false
  },
  playWaiting: {
    type: Number,
    default: 500
  },
  noBuffer: {
    type: Boolean,
    default: false
  },
  noTransition: {
    type: Boolean,
    default: false
  },
  beforeScroll: {
    type: Function as PropType<(payload: { signX: number, signY: number }) => boolean>,
    default: null
  }
})

export default defineComponent({
  name: 'Scroll',
  components: {
    Scrollbar
  },
  props,
  emits: [
    'on-x-enable-change',
    'on-y-enable-change',
    'on-wheel',
    'on-scroll-start',
    'on-scroll',
    'on-scroll-end',
    'on-bar-scroll-start',
    'on-bar-scroll-end',
    'on-ready'
  ],
  setup(props, { emit }) {
    const emitter = createEventEmitter()

    const prefix = 'vxp-scroll'
    const usingBar = ref(false)
    const scrolling = ref(false)
    const transitionDuration = ref<number>(-1)

    const {
      wrapperElement,
      contentElement,

      wrapper,
      isReady,
      currentScroll,
      percentX,
      percentY,
      xScrollLimit,
      yScrollLimit,
      enableXScroll,
      enableYScroll,
      xBarLength,
      yBarLength,

      verifyScroll,
      computePercent,
      refresh
    } = useScrollWrapper({
      mode: toRef(props, 'mode'),
      disabled: toRef(props, 'disabled'),
      width: toRef(props, 'width'),
      height: toRef(props, 'height'),
      scrollX: toRef(props, 'scrollX'),
      scrollY: toRef(props, 'scrollY'),
      beforeRefresh: stopAutoplay,
      afterRefresh: startAutoplay
    })

    /* autoplay */
    const canPlay = ref(false)

    const canAutoplay = computed(() => {
      return (
        props.mode !== 'both' &&
        (isTrue(props.autoplay) || props.autoplay > 1000) &&
        ((props.mode === 'horizontal' && enableXScroll.value) ||
          (props.mode === 'vertical' && enableYScroll.value))
      )
    })

    watch(
      () => props.autoplay,
      () => {
        stopAutoplay()
        nextTick(startAutoplay)
      }
    )
    watch(
      () => props.playWaiting,
      () => {
        stopAutoplay()
        nextTick(startAutoplay)
      }
    )

    let playTimer: number
    let startTimer: number
    let endTimer: number

    function startAutoplay() {
      if (!canAutoplay.value) return

      stopAutoplay()

      const mode = props.mode
      const distance = mode === 'horizontal' ? 'width' : 'height'
      const limit = mode === 'horizontal' ? xScrollLimit : yScrollLimit
      const prop = mode === 'horizontal' ? 'x' : 'y'
      const waiting = props.playWaiting < 20 ? 20 : props.playWaiting

      let playSpeed = 0.5

      if (typeof props.autoplay === 'number') {
        playSpeed = (wrapper[distance] / props.autoplay) * 16
      }

      const scroll = () => {
        currentScroll[prop] -= playSpeed

        if (currentScroll[prop] <= limit.value) {
          currentScroll[prop] = limit.value
          canPlay.value = false

          computePercent()

          endTimer = window.setTimeout(() => {
            scrollTo(0, 0, 500)

            startTimer = window.setTimeout(() => {
              canPlay.value = true
              scroll()
            }, 500 + waiting)
          }, waiting)
        } else {
          computePercent()

          if (canPlay.value) {
            requestAnimationFrame(scroll)
          }
        }
      }

      playTimer = window.setTimeout(() => {
        canPlay.value = true
        scroll()
      }, waiting)
    }

    function stopAutoplay() {
      canPlay.value = false

      window.clearTimeout(playTimer)
      window.window.clearTimeout(startTimer)
      window.clearTimeout(endTimer)
    }
    /* autoplay */

    const className = computed(() => {
      return [prefix, `${prefix}--${props.mode}`]
    })
    const style = computed(() => {
      const { width, height } = props

      return {
        width: width
          ? typeof width === 'string'
            ? Number.isNaN(Number(width))
              ? width
              : `${Number(width)}px`
            : `${width}px`
          : undefined,
        height: height
          ? typeof height === 'string'
            ? Number.isNaN(Number(height))
              ? height
              : `${Number(height)}px`
            : `${height}px`
          : undefined
      }
    })
    const wrapperClass = computed(() => {
      return [
        `${prefix}__wrapper`,
        props.scrollClass,
        {
          [`${prefix}__wrapper--scrolling`]: scrolling.value,
          [`${prefix}__wrapper--no-ready`]: !isReady.value,
          [`${prefix}__wrapper--using-bar`]: usingBar.value,
          [`${prefix}__wrapper--no-transition`]: props.noTransition
        }
      ]
    })
    const wrapperStyle = computed(() => {
      return {
        transform: `translate3d(${currentScroll.x}px, ${currentScroll.y}px, 0)`,
        transitionDuration:
          transitionDuration.value < 0 ? undefined : `${transitionDuration.value}ms`
      }
    })

    watch(enableXScroll, value => {
      emit('on-x-enable-change', value)
    })
    watch(enableYScroll, value => {
      emit('on-y-enable-change', value)
    })
    watch(isReady, value => {
      if (value) emit('on-ready')
    })

    function handleMouseDown(event: MouseEvent) {
      if (!props.pointer || event.button !== 0 || USE_TOUCH) {
        return false
      }

      handlePointerDown(event)
    }

    function handleTouchStart(event: TouchEvent) {
      if (!props.pointer || event.touches.length !== 1) {
        return false
      }

      handlePointerDown(event)
    }

    // 记录滚动开始位置
    let xScrollStartAt = 0
    let yScrollStartAt = 0

    // 记录滚动开始鼠标位置
    let cursorXPosition = 0
    let cursorYPosition = 0

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!enableXScroll.value && !enableYScroll.value) {
        return false
      }

      event.preventDefault()
      prepareScroll()

      transitionDuration.value = 0

      const pointer = 'touches' in event ? event.touches[0] : event

      xScrollStartAt = currentScroll.x
      yScrollStartAt = currentScroll.y
      cursorXPosition = pointer.clientX
      cursorYPosition = pointer.clientY

      document.addEventListener(moveEvent, handlePointerMove)
      document.addEventListener(upEvent, handlePointerUp)

      emit('on-scroll-start', {
        clientX: -currentScroll.x,
        clientY: -currentScroll.y,
        percentX: percentX.value,
        percentY: percentY.value
      })
    }

    function handlePointerMove(event: MouseEvent | TouchEvent) {
      event.stopPropagation()

      if (!USE_TOUCH) {
        event.preventDefault()
      }

      const pointer = 'touches' in event ? event.touches[0] : event
      const signX = pointer.clientX - cursorXPosition > 0 ? 1 : -1
      const signY = pointer.clientY - cursorYPosition > 0 ? 1 : -1

      if (props.beforeScroll?.({ signX, signY }) === false) {
        return false
      }

      scrolling.value = true

      if (enableXScroll.value) {
        currentScroll.x = xScrollStartAt + pointer.clientX - cursorXPosition
      }

      if (enableYScroll.value) {
        currentScroll.y = yScrollStartAt + pointer.clientY - cursorYPosition
      }

      if (props.noBuffer) {
        verifyScroll()
      } else {
        computePercent()
      }

      emitScrollEvent('both')
    }

    function handlePointerUp() {
      document.removeEventListener(moveEvent, handlePointerMove)
      document.removeEventListener(upEvent, handlePointerUp)

      transitionDuration.value = -1

      handleBuffer()
      verifyScroll()
      emitScrollEvent('both')
      emit('on-scroll-end', {
        clientX: -currentScroll.x,
        clientY: -currentScroll.y,
        percentX: percentX.value,
        percentY: percentY.value
      })
      startAutoplay()
    }

    // 按下 shift 时为横向滚动，保持和原生操作一致
    function handleWheel(event: WheelEvent, type: 'vertical' | 'horizontal') {
      const isVerticalScroll = enableYScroll.value && type === 'vertical'
      const isHorizontalScroll = enableXScroll.value && type === 'horizontal'

      // 纵横滚动均使用 deltaY 标记
      const sign = event.deltaY > 0 ? -1 : 1

      if (
        props.wheel &&
        (isVerticalScroll || isHorizontalScroll) &&
        props.beforeScroll?.({ signX: -sign, signY: -sign }) !== false
      ) {
        event.preventDefault()
        event.stopPropagation()
      } else {
        return true
      }

      if (props.mode !== 'both' && props.mode !== type) return false

      prepareScroll()

      const computedDelta = sign * (type === 'horizontal' ? props.deltaX : props.deltaY)

      if (isVerticalScroll) {
        currentScroll.y += computedDelta
      } else if (isHorizontalScroll) {
        currentScroll.x += computedDelta
      }

      verifyScroll()
      emitScrollEvent(type)

      emit('on-wheel', {
        type,
        sign: -sign,
        clientX: -currentScroll.x,
        clientY: -currentScroll.y,
        percentX: percentX.value,
        percentY: percentY.value
      })

      startAutoplay()
    }

    let bufferTimer: number

    function prepareScroll() {
      stopAutoplay()
      window.clearTimeout(bufferTimer)
    }

    function handleBuffer() {
      if (props.noBuffer) {
        bufferTimer = window.setTimeout(() => {
          scrolling.value = false
        }, 300)
      } else {
        scrolling.value = false
      }
    }

    function handleBarScrollStart(type: 'vertical' | 'horizontal') {
      usingBar.value = true
      emit('on-bar-scroll-start', type)
    }

    function handleBarScrollEnd(type: 'vertical' | 'horizontal') {
      usingBar.value = false
      emit('on-bar-scroll-end', type)
    }

    function handleXBarScroll(percent: number) {
      percentX.value = percent
      currentScroll.x = (percent * xScrollLimit.value) / 100

      emitScrollEvent('horizontal')
    }

    function handleYBarScroll(percent: number) {
      percentY.value = percent
      currentScroll.y = (percent * yScrollLimit.value) / 100

      emitScrollEvent('vertical')
    }

    function emitScrollEvent(type: ScrollMode) {
      emit('on-scroll', {
        type,
        clientX: -currentScroll.x,
        clientY: -currentScroll.y,
        percentX: percentX.value,
        percentY: percentY.value
      })
      emitter.emit('on-scroll', {
        type,
        clientX: -currentScroll.x,
        clientY: -currentScroll.y,
        percentX: percentX.value,
        percentY: percentY.value
      })
    }

    function scrollTo(clientX: number, clientY: number, duration?: number) {
      setDuration(duration)

      nextTick(() => {
        let changed = false

        if (enableXScroll.value && Math.abs(currentScroll.x + clientX) > 0.01) {
          currentScroll.x = -clientX
          changed = true
        }

        if (enableYScroll.value && Math.abs(currentScroll.y + clientY) > 0.01) {
          currentScroll.y = -clientY
          changed = true
        }

        verifyScroll()

        if (!changed) transitionDuration.value = -1
      })
    }

    function scrollBy(deltaX: number, deltaY: number, duration?: number) {
      setDuration(duration)

      nextTick(() => {
        let changed = false

        if (deltaX && enableXScroll) {
          currentScroll.x -= deltaX
          changed = true
        }

        if (deltaY && enableYScroll) {
          currentScroll.y -= deltaY
          changed = true
        }

        verifyScroll()

        if (!changed) transitionDuration.value = -1
      })
    }

    function setDuration(duration?: number) {
      if (typeof duration === 'number') {
        transitionDuration.value = duration

        if (transitionDuration.value === 0) {
          nextTick(() => {
            transitionDuration.value = -1
          })
        }
      }
    }

    function getXScrollLimit() {
      return [0, -xScrollLimit.value]
    }

    function getYScrollLimit() {
      return [0, -yScrollLimit.value]
    }

    function scrollToElement(el: string | Element, duration?: number, offset = 0) {
      if (!contentElement.value) return

      if (typeof el === 'string') {
        el = contentElement.value.querySelector(el)!
      }

      if (!(el instanceof Node)) return

      const wrapperRect = contentElement.value.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()

      let clientX = 0
      let clientY = 0

      if (props.mode !== 'vertical') {
        clientX = elRect.left - wrapperRect.left + offset
      }

      if (props.mode !== 'horizontal') {
        clientY = elRect.top - wrapperRect.top + offset
      }

      scrollTo(clientX, clientY, duration)
    }

    function addScrollListener(listener: EventHandler) {
      emitter.on('on-scroll', listener)
    }

    function removeScrollListener(listener: EventHandler) {
      emitter.off('on-scroll', listener)
    }

    return {
      percentX,
      percentY,
      transitionDuration,
      currentScroll,

      className,
      style,
      wrapperClass,
      wrapperStyle,
      xBarLength,
      yBarLength,
      enableXScroll,
      enableYScroll,

      wrapper: wrapperElement,
      content: contentElement,

      handleMouseDown,
      handleTouchStart,
      handleWheel,
      handleBarScrollStart,
      handleBarScrollEnd,
      handleXBarScroll,
      handleYBarScroll,

      refresh,
      scrollTo,
      scrollBy,
      getXScrollLimit,
      getYScrollLimit,
      scrollToElement,
      addScrollListener,
      removeScrollListener
    }
  }
})
</script>
