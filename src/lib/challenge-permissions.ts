type Editor = { id: string; role: string };
type Challenge = { authorId?: string; status: string };

export function canManageChallengeDraft(viewer: Editor, challenge: Challenge) {
  return viewer.role === "admin" || viewer.role === "author" && challenge.authorId === viewer.id;
}

export function canEditChallengeContent(viewer: Editor, challenge: Challenge) {
  if (viewer.role === "admin") return true;
  if (challenge.status === "draft") return canManageChallengeDraft(viewer, challenge);
  return challenge.status === "review" && challenge.authorId !== viewer.id &&
    (viewer.role === "reviewer" || viewer.role === "admin");
}
