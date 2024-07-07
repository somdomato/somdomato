import { Tooltip, Popover } from 'bootstrap'

export const tooltip = {
  mounted(el: HTMLElement) {
    const tooltip = new Tooltip(el)
  }
}

export const popover = {
  mounted(el: HTMLElement) {
    const popover = new Popover(el, { html: true })
  }
}