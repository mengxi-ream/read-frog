import adviceIcon from "@/assets/icon/advice.svg";
import discordIcon from "@/assets/icon/discord.svg";
import helpIcon from "@/assets/icon/help.svg";

const LINKS: { label: string; icon: string; url: string }[] = [
  {
    label: "Help",
    icon: helpIcon,
    url: "https://readfrog.mengxi.work/tutorial/installation",
  },
  {
    label: "Advice",
    icon: adviceIcon,
    url: "https://wj.qq.com/s2/22031975/aea0/",
  },
  {
    label: "Discord",
    icon: discordIcon,
    url: "https://discord.gg/nmhvb6u2T7",
  },
];

export default function QuickLinks() {
  return (
    <div className="flex justify-between">
      {LINKS.map((link) => (
        <LinkCard key={link.url} link={link} />
      ))}
    </div>
  );
}

function LinkCard({ link }: { link: (typeof LINKS)[number] }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className="border-border bg-input/50 hover:bg-input flex w-20 flex-col items-center justify-center gap-1.5 rounded-md border py-3 text-sm"
    >
      <img src={link.icon} alt={link.label} className="size-5" />
      {link.label}
    </a>
  );
}
