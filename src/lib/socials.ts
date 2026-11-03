import type { PlayerProfile, ProfileIdentity } from "./player-profile";

export type FriendshipState = "none" | "incoming" | "outgoing" | "friends" | "self";
export type FriendAction = "request" | "accept" | "decline" | "cancel" | "remove";
export type SocialKind = "friends" | "incoming" | "outgoing";
export type SocialPlayer = { codename: string; displayName: string; relationship: FriendshipState };
export type PlayerPage = { items: SocialPlayer[]; nextCursor: string | null };
export type ViewedPlayer = Pick<PlayerProfile, "scope" | "asOf" | "stats" | "categories" | "milestones"> & {
  identity: Omit<ProfileIdentity, "shareProfile">;
  detailsShared: boolean;
  relationship: FriendshipState;
  activity: PlayerProfile["activity"]["items"];
};

export function playerHref(codename: string) {
  return `/?${new URLSearchParams({ view: "socials", player: codename })}`;
}
