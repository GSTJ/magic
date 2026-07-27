// EXPECT under DEFAULT preset: NO magic(prefer-suspense-query) — opt-in only.
declare const api: {
  users: { list: { useQuery: () => { data?: string[] } } };
};

export const useUsers = (): string[] | undefined => {
  const { data } = api.users.list.useQuery();
  return data;
};
