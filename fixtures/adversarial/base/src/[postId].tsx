// A file-based router's route parameter. Exempt via `filenameCaseIgnore` in
// `base`, because kebab-casing the brackets would rewrite the route contract:
// `params.postId` is not `params.post-id`.
export const postId = "[postId].tsx";
