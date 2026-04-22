import type { ModuleOptions } from '../module'

export default (options: Required<ModuleOptions>) => ({
  slots: {
    root: 'relative min-w-0',
    list: 'flex items-center gap-x-2.5 gap-y-1',
    item: 'flex min-w-0',
    link: 'group relative flex items-center gap-1.5 text-sm min-w-0 focus-visible:outline-primary',
    linkLeadingIcon: 'shrink-0 size-5',
    linkLeadingAvatar: 'shrink-0',
    linkLeadingAvatarSize: '2xs',
    linkLabel: 'truncate',
    separator: 'flex',
    separatorLabel: 'text-muted text-sm',
    separatorIcon: 'shrink-0 size-5 text-muted',
    ellipsisIcon: 'shrink-0 size-5 text-muted'
  },
  variants: {
    active: {
      true: {
        link: 'text-primary font-semibold pointer-events-none cursor-default'
      },
      false: {
        link: 'text-muted font-medium'
      }
    },
    disabled: {
      true: {
        link: 'cursor-not-allowed opacity-75'
      }
    },
    to: {
      true: ''
    }
  },
  compoundVariants: [{
    disabled: false,
    active: false,
    to: true,
    class: {
      link: ['hover:text-default hover:underline underline-offset-4', options.theme.transitions && 'transition-colors']
    }
  }]
})
