<template>
  <li
    ref="wrapper"
    :class="className"
    :aria-disabled="disabled"
    @click="handleSelect"
  >
    <div v-if="icon" :class="`${prefix}__icon`">
      <Icon :name="icon"></Icon>
    </div>
    <slot>
      {{ label }}
    </slot>
  </li>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed, inject, watch, onBeforeUnmount } from 'vue'
import { Icon } from '@/components/icon'
import { isDefined } from '@/common/utils/common'
import { TAB_NAV_STATE } from './symbol'

import type { ItemState } from './symbol'

const props = {
  label: {
    type: [String, Number],
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: ''
  }
}

export default defineComponent({
  name: 'TabNavItem',
  components: {
    Icon
  },
  props,
  emits: ['on-toggle'],
  setup(props, { emit }) {
    const tabNavState = inject(TAB_NAV_STATE, null)

    const prefix = 'vxp-tab-nav'
    const active = ref(false)
    const currentLabel = ref(props.label)

    const wrapper = ref<HTMLElement | null>(null)

    const className = computed(() => {
      const baseClass = `${prefix}__item`

      return {
        [baseClass]: true,
        [`${baseClass}--disabled`]: props.disabled,
        [`${baseClass}--active`]: !props.disabled && active.value
      }
    })

    watch(
      () => props.label,
      value => {
        currentLabel.value = value
        tabNavState?.refreshLabels()
      }
    )
    watch(active, value => {
      emit('on-toggle', value)
    })

    if (tabNavState) {
      const state: ItemState = reactive({
        el: wrapper,
        label: currentLabel
      })

      watch(currentLabel, (value, prevValue) => {
        if (isDefined(prevValue) && prevValue === tabNavState.currentActive) {
          tabNavState.handleActive(value)
        }
      })
      watch(
        () => tabNavState.currentActive,
        value => {
          active.value = currentLabel.value === value
        },
        { immediate: true }
      )

      tabNavState.increaseItem(state)

      onBeforeUnmount(() => {
        tabNavState.decreaseItem(state)
      })
    }

    function handleSelect() {
      if (props.disabled) {
        return
      }

      if (tabNavState) {
        tabNavState.handleActive(currentLabel.value)
      }
    }

    return {
      prefix,

      className,

      wrapper,

      handleSelect
    }
  }
})
</script>
