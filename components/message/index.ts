import '@/style/message.scss'

import { createApp } from 'vue'
import Component from './message.vue'
import { isNull } from '@/common/utils/common'
import { toNumber } from '@/common/utils/number'
import { destroyObject } from '@/common/utils/destroy-object'

import '@/common/icons/info-circle'
import '@/common/icons/check-circle'
import '@/common/icons/exclamation-circle'
import '@/common/icons/times-circle'

import type { App } from 'vue'
import type { Key, MessageType, MessagePlacement, MessageOptions, MessageInstance } from './symbol'

type FuzzyOptions = string | MessageOptions
type ManagerOptions = { duration?: number, placement?: MessagePlacement } & Record<string, unknown>

interface AipMethod {
  (options: MessageOptions): () => void,
  (content: string, duration?: number): () => void
}

const conveniences: Record<MessageType, { icon: string }> = {
  info: {
    icon: 'info-circle'
  },
  success: {
    icon: 'check-circle'
  },
  warning: {
    icon: 'exclamation-circle'
  },
  error: {
    icon: 'times-circle'
  }
}

const placementWhiteList: MessagePlacement[] = ['top', 'bottom']

let count = 1

function getKey() {
  return `message-${count++}`
}

export class MessageManager {
  name: string
  defaults: Record<string, unknown>

  open: AipMethod
  info: AipMethod
  success: AipMethod
  warning: AipMethod
  error: AipMethod

  private _instance: MessageInstance | null
  private _innerApp: App<unknown> | null
  private _container: HTMLElement | null

  constructor(options: ManagerOptions = {}) {
    options = {
      ...options,
      duration: options.duration ? toNumber(options.duration) : 3000
    }

    this._instance = null
    this._innerApp = null
    this._container = null
    this.name = 'Message'
    this.defaults = {}

    this.config(options)

    this.open = (content: FuzzyOptions, duration?: number) => {
      return this._open(null, content, duration)
    }

    this.info = (content: FuzzyOptions, duration?: number) => {
      return this._open('info', content, duration)
    }

    this.success = (content: FuzzyOptions, duration?: number) => {
      return this._open('success', content, duration)
    }

    this.warning = (content: FuzzyOptions, duration?: number) => {
      return this._open('warning', content, duration)
    }

    this.error = (content: FuzzyOptions, duration?: number) => {
      return this._open('error', content, duration)
    }
  }

  close(key: Key) {
    if (isNull(key)) {
      this.clear()
    } else {
      this._getInstance().remove(key)
    }
  }

  config({ placement, ...others }: { placement?: MessagePlacement, [x: string]: unknown }) {
    if (placement) {
      this._getInstance().placement = placementWhiteList.includes(placement)
        ? placement
        : placementWhiteList[0]
    }

    this.defaults = { ...this.defaults, ...others }
  }

  clone() {
    return new MessageManager(this.defaults)
  }

  clear() {
    this._getInstance().clear()
  }

  destroy() {
    this._innerApp?.unmount()
    destroyObject(this)
  }

  isDestroyed() {
    return false
  }

  install(app: App, options: ManagerOptions & { property?: string } = {}) {
    const { property, ...others } = options

    this.config(others)
    app.config.globalProperties[property || '$message'] = this
  }

  private _getInstance() {
    if (!this._instance) {
      this._container = document.createElement('div')
      // 使用 createVNode 和 render 手动控制可以有效降低开销
      // 然而使用上述方式创建的组件无法被 devTool 正确加载
      // 因此选择开销更大的 createApp 以保证 devTool 的正常运行
      this._innerApp = createApp(Component)
      this._instance = this._innerApp.mount(this._container) as MessageInstance

      document.body.appendChild(this._container.firstElementChild!)
    }

    return this._instance
  }

  private _open(type: null | MessageType, content: FuzzyOptions, _duration?: number) {
    const options = typeof content === 'string' ? { content, duration: _duration } : content

    const key = options.key ?? getKey()
    const message = this._getInstance()
    const convenienceOptions = type ? conveniences[type] ?? {} : {}

    let timer: number

    const userCloseFn = options.onClose
    const onClose = () => {
      clearTimeout(timer)

      if (typeof userCloseFn === 'function') {
        return userCloseFn()
      }
    }

    const item = Object.assign({}, this.defaults, convenienceOptions, options, {
      key,
      type,
      onClose
    })

    message.add(item)

    const duration = typeof item.duration === 'number' ? item.duration : 3000

    if (duration >= 500) {
      timer = window.setTimeout(() => {
        message.remove(key)
      }, duration)
    }

    return () => {
      clearTimeout(timer)
      message.remove(key)
    }
  }
}

export const Message = new MessageManager()
