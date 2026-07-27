// EXPECT with magic/prefer-suspense-query ON (roots: api, trpc):
//   - api.users.list.useQuery()      -> fires
//   - trpc.posts.byId.useQuery()     -> fires
//   - somethingElse.useQuery()       -> must NOT fire (root not configured)
//   - api.users.list.useSuspenseQuery() -> must NOT fire
interface Query {
  useQuery: () => { data?: string[] };
}
interface SuspenseQuery {
  useSuspenseQuery: () => { data: string[] };
}

declare const api: { users: { list: Query & SuspenseQuery } };
declare const trpc: { posts: { byId: Query } };
declare const somethingElse: Query;

export const useAll = (): void => {
  api.users.list.useQuery(); // fires
  trpc.posts.byId.useQuery(); // fires
  somethingElse.useQuery(); // must not fire
  api.users.list.useSuspenseQuery(); // must not fire
};
