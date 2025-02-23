import type { ComponentPublicInstance } from 'vue'

export type Key = string | number
export type NoticeType = 'info' | 'success' | 'warning' | 'error'
export type NoticePlacement = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

export interface NoticeOptions extends Record<string, unknown> {
  title?: string,
  content?: string,
  key?: Key,
  icon?: string | Record<string, unknown> | (() => any),
  type?: NoticeType,
  duration?: number,
  renderer?: () => any
  // className: string | any[] | { [x: string]: any }
  // background?: boolean
  // color?: boolean
  // closable?: boolean
  // icon?: string
  // iconColor?: string
}

export interface NoticeInstance extends ComponentPublicInstance {
  placement: NoticePlacement,
  add: (options: NoticeOptions) => void,
  remove: (key: string | number) => void,
  clear: () => void
}
