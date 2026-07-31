import { IconBrandWechat, IconBug, IconMail, IconMessageCircle } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import wechatAccountImage from "@/assets/wechat-account.jpg"
import {
  FluidCard,
  FluidCardDescription,
  FluidCardGroup,
  FluidCardHeader,
  FluidCardMedia,
  FluidCardTitle,
} from "@/components/ui/base-ui/fluid-card"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/base-ui/hover-card"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { buildFeaturebasePortalUrl } from "@/utils/featurebase"
import { i18n } from "@/utils/i18n"
import { resolveUiLocale } from "@/utils/i18n/locale-map"
import { PageLayout } from "../../components/page-layout"

const SUPPORT_EMAIL = "contact@readfrog.app"

/**
 * WeChat can't be linked to — the QR has to be shown in place — so it trades the card's
 * stretched link for a preview card, opened by a target stretched over the card the same
 * way `FluidCard` stretches its own link. Base UI opens on hover *and* on press, so
 * pointer, touch and keyboard all reach it.
 *
 * The trigger is a button rather than the card itself: Base UI's trigger merges its props
 * onto whatever it renders, so rendering the card through it would overwrite the card's
 * own `data-slot`.
 *
 * `index` is passed through by hand because `FluidCardGroup` assigns it to its direct
 * children, and here that child is this wrapper rather than the card.
 */
function WechatCard({ index }: { index?: number }) {
  return (
    <FluidCard index={index}>
      <FluidCardHeader>
        <FluidCardMedia icon={IconBrandWechat} />
        <FluidCardTitle>{i18n.t("options.contactUs.wechat.title")}</FluidCardTitle>
        <FluidCardDescription>
          {i18n.t("options.contactUs.wechat.description")}
        </FluidCardDescription>
      </FluidCardHeader>
      <HoverCard>
        <HoverCardTrigger
          render={
            <button
              type="button"
              aria-label={i18n.t("options.contactUs.wechat.title")}
              className="absolute inset-0 z-20 cursor-pointer rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        />
        <HoverCardContent className="w-56 p-2">
          <img
            src={wechatAccountImage}
            alt={i18n.t("options.contactUs.wechat.qrCodeAlt")}
            // The code carries its own light backdrop so it stays scannable on a dark popup.
            className="w-full rounded-md bg-white"
          />
        </HoverCardContent>
      </HoverCard>
    </FluidCard>
  )
}

export function ContactUsPage() {
  const uiLanguage = useAtomValue(configFieldsAtomMap.uiLanguage)
  const locale = resolveUiLocale(uiLanguage)

  return (
    <PageLayout
      title={i18n.t("options.contactUs.title")}
      description={i18n.t("options.contactUs.pageDescription")}
    >
      <FluidCardGroup columns={2}>
        <FluidCard
          // The portal's own root is the feedback board; `roadmap` keeps its sidebar entry.
          href={buildFeaturebasePortalUrl({ destination: "feedback", locale })}
          external
          label={i18n.t("options.contactUs.featureRequest.title")}
        >
          <FluidCardHeader>
            <FluidCardMedia icon={IconMessageCircle} />
            <FluidCardTitle>{i18n.t("options.contactUs.featureRequest.title")}</FluidCardTitle>
            <FluidCardDescription>
              {i18n.t("options.contactUs.featureRequest.description")}
            </FluidCardDescription>
          </FluidCardHeader>
        </FluidCard>

        <FluidCard
          href={buildFeaturebasePortalUrl({ destination: "tickets", locale })}
          external
          label={i18n.t("options.contactUs.bugReport.title")}
        >
          <FluidCardHeader>
            <FluidCardMedia icon={IconBug} />
            <FluidCardTitle>{i18n.t("options.contactUs.bugReport.title")}</FluidCardTitle>
            <FluidCardDescription>
              {i18n.t("options.contactUs.bugReport.description")}
            </FluidCardDescription>
          </FluidCardHeader>
        </FluidCard>

        <FluidCard
          href={`mailto:${SUPPORT_EMAIL}`}
          external
          label={i18n.t("options.contactUs.email.title")}
        >
          <FluidCardHeader>
            <FluidCardMedia icon={IconMail} />
            <FluidCardTitle>{i18n.t("options.contactUs.email.title")}</FluidCardTitle>
            <FluidCardDescription>
              {i18n.t("options.contactUs.email.description")}
            </FluidCardDescription>
          </FluidCardHeader>
        </FluidCard>

        <WechatCard />
      </FluidCardGroup>
    </PageLayout>
  )
}
