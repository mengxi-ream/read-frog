import type { NavItem } from './nav-items'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@repo/ui/components/sidebar'
import { cn } from '@repo/ui/lib/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router'
import readFrogLogo from '@/assets/icons/read-frog.png'
import { getLastViewedBlogDate, getLatestBlogDate, hasNewBlogPost, saveLastViewedBlogDate } from '@/utils/blog'
import { WEBSITE_URL } from '@/utils/constants/url'
import { getLastViewedSurvey, hasNewSurvey, saveLastViewedSurvey } from '@/utils/survey'
import { version } from '../../../../package.json'
import { AnimatedIndicator } from './animated-indicator'
import { PRODUCT_NAV_ITEMS, SETTING_NAV_ITEMS } from './nav-items'

function renderNavItem(
  key: string,
  item: NavItem,
  currentPath: string,
  open: boolean,
  action: boolean = false,
  onClick?: () => void,
  overrideUrl?: string,
) {
  const title = i18n.t(`options.${item.title}.title`)

  switch (item.type) {
    case 'external':
      return (
        <SidebarMenuItem key={key} className="relative">
          <SidebarMenuButton
            asChild
            className={cn(action && 'text-primary font-semibold hover:text-primary active:text-primary')}
          >
            <a
              href={overrideUrl ?? item.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClick}
            >
              <Icon icon={item.icon} />
              <span>{title}</span>
            </a>
          </SidebarMenuButton>
          <AnimatedIndicator show={action && open} />
        </SidebarMenuItem>
      )

    case 'component':
      return (
        <SidebarMenuItem key={key} className="relative">
          <SidebarMenuButton
            asChild
            className={cn(action && 'text-primary font-semibold hover:text-primary')}
            isActive={currentPath === item.url}
          >
            <Link to={item.url} onClick={onClick}>
              <Icon icon={item.icon} />
              <span>{title}</span>
            </Link>
          </SidebarMenuButton>
          <AnimatedIndicator show={action && open} />
        </SidebarMenuItem>
      )
  }
}

export function AppSidebar() {
  const location = useLocation()
  const { open } = useSidebar()
  const queryClient = useQueryClient()

  const { data: lastViewedDate } = useQuery({
    queryKey: ['last-viewed-blog-date'],
    queryFn: getLastViewedBlogDate,
  })

  const { data: latestBlogPost } = useQuery({
    queryKey: ['latest-blog-post'],
    queryFn: () => getLatestBlogDate(`${WEBSITE_URL}/api/blog/latest`, 'en'),
  })

  const { data: lastViewedSurveyUrl } = useQuery({
    queryKey: ['last-viewed-survey'],
    queryFn: getLastViewedSurvey,
  })

  const handleWhatsNewClick = async () => {
    if (latestBlogPost) {
      await saveLastViewedBlogDate(latestBlogPost.date)
      await queryClient.invalidateQueries({ queryKey: ['last-viewed-blog-date'] })
    }
  }

  const handleSurveyClick = async () => {
    const surveyItem = PRODUCT_NAV_ITEMS.survey
    if (surveyItem.type === 'external') {
      await saveLastViewedSurvey(surveyItem.externalUrl)
      await queryClient.invalidateQueries({ queryKey: ['last-viewed-survey'] })
    }
  }

  const showBlogIndicator = hasNewBlogPost(
    lastViewedDate ?? null,
    latestBlogPost?.date ?? null,
    version,
    latestBlogPost?.extensionVersion ?? null,
  )

  const surveyItem = PRODUCT_NAV_ITEMS.survey
  const showSurveyIndicator = surveyItem.type === 'external'
    ? hasNewSurvey(lastViewedSurveyUrl ?? null, surveyItem.externalUrl)
    : false

  const indicatorMap: Record<string, boolean> = {
    'whats-new': showBlogIndicator,
    'survey': showSurveyIndicator,
  }

  const clickHandlerMap: Record<string, () => void> = {
    'whats-new': handleWhatsNewClick,
    'survey': handleSurveyClick,
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[state=expanded]:px-5 group-data-[state=expanded]:pt-4 transition-all">
        <a href="https://readfrog.app" className="flex items-center gap-2">
          <img src={readFrogLogo} alt="Logo" className="h-8 w-8 shrink-0" />
          <span className="text-md font-bold overflow-hidden truncate">{i18n.t('name')}</span>
          <span className="text-xs text-muted-foreground overflow-hidden truncate">
            {`v${version}`}
          </span>
        </a>
      </SidebarHeader>
      <SidebarContent className="group-data-[state=expanded]:px-2 transition-all">
        <SidebarGroup>
          <SidebarGroupLabel>{i18n.t('options.sidebar.settings')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {Object.entries(SETTING_NAV_ITEMS).map(([key, item]) =>
                renderNavItem(key, item, location.pathname, open),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{i18n.t('options.sidebar.product')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {Object.entries(PRODUCT_NAV_ITEMS).map(([key, item]) => {
                const shouldShowIndicator = indicatorMap[key] ?? false
                const handleClick = clickHandlerMap[key]
                // Use the latest blog post URL for the "What's New" item
                // Convert relative URL to absolute URL
                const overrideUrl = key === 'whats-new' && latestBlogPost?.url
                  ? `${WEBSITE_URL}${latestBlogPost.url}`
                  : undefined
                return renderNavItem(
                  key,
                  item,
                  location.pathname,
                  open,
                  item.action && shouldShowIndicator,
                  item.action ? handleClick : undefined,
                  overrideUrl,
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
