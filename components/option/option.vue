<template>
  <li
    v-show="!hidden"
    ref="wrapper"
    :class="className"
    :title="noTitle ? undefined : String(truthValue)"
    @click="handleSelect"
  >
    <slot :selected="selected">
      {{ truthLabel }}
    </slot>
  </li>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  reactive,
  computed,
  watch,
  inject,
  onMounted,
  onUpdated,
  onBeforeUnmount,
  nextTick
} from 'vue'
import { isNull } from '@/common/utils/common'
import { SELECTOR_STATE } from './symbol'

import type { OptionState } from './symbol'

const props = {
  value: {
    type: [String, Number],
    default: null
  },
  label: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  divided: {
    type: Boolean,
    default: false
  },
  noTitle: {
    type: Boolean,
    default: false
  }
}

export default defineComponent({
  name: 'Option',
  props,
  emits: ['on-select'],
  setup(props, { emit }) {
    const selectorState = inject(SELECTOR_STATE, null)

    const prefix = 'vxp-option'
    const truthLabel = ref(props.label ?? props.value.toString())
    const truthValue = ref<string | number>(props.value)
    const hidden = ref(false)
    const hitting = ref(false)

    const wrapper = ref<HTMLElement | null>(null)

    const state: OptionState = reactive({
      hidden,
      hitting,
      label: truthLabel,
      value: truthValue
    })

    const selected = computed(() => {
      return !!selectorState?.isSelected?.(truthValue.value)
    })
    const className = computed(() => {
      return {
        [prefix]: true,
        [`${prefix}--disabled`]: props.disabled,
        [`${prefix}--selected`]: !props.disabled && selected.value,
        [`${prefix}--divided`]: props.divided,
        [`${prefix}--hitting`]: hitting.value
      }
    })

    watch(
      () => props.label,
      value => {
        truthLabel.value = value
        updateSelectLable()
      }
    )
    watch(
      () => props.value,
      value => {
        truthValue.value = value
      }
    )

    // if (selectorState) {
    //   watch(() => selectorState.currentValue, computeValueAndLabel)
    // }

    onMounted(() => {
      computeValueAndLabel()

      if (typeof selectorState?.addOption === 'function') {
        selectorState.addOption(state)
      }
    })

    onUpdated(() => {
      computeValueAndLabel()
    })

    onBeforeUnmount(() => {
      if (typeof selectorState?.removeOption === 'function') {
        selectorState.removeOption(state)
      }
    })

    function handleSelect() {
      if (props.disabled) return

      emit('on-select', truthValue.value, truthLabel.value)

      if (typeof selectorState?.handleSelect === 'function') {
        selectorState.handleSelect(truthValue.value, truthLabel.value)
      }
    }

    function computeValueAndLabel() {
      nextTick(() => {
        if (!wrapper.value) return

        truthValue.value = isNull(props.value)
          ? wrapper.value?.textContent?.trim() ?? ''
          : props.value
        truthLabel.value = !String(props.label)
          ? wrapper.value?.textContent?.trim() ?? truthValue.value?.toString() ?? ''
          : props.label

        updateSelectLable()
      })
    }

    function updateSelectLable() {
      if (
        selectorState?.isSelected?.(truthValue.value) &&
        typeof selectorState.setCurrentLabel === 'function'
      ) {
        selectorState.setCurrentLabel(truthLabel.value, truthValue.value)
      }
    }

    return {
      truthLabel,
      truthValue,
      hidden,

      className,
      selected,

      wrapper,

      handleSelect
    }
  }
})
</script>
