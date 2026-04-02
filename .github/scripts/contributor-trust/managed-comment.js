import { COMMENT_MARKER_HTML, MANAGED_COMMENT_AUTHOR } from "./config.js"

export function isManagedTrustComment(comment) {
  return comment?.user?.login === MANAGED_COMMENT_AUTHOR
    && comment.body?.includes(COMMENT_MARKER_HTML)
}

export function findManagedTrustComment(comments) {
  return comments.find(isManagedTrustComment)
}
