import { useQuery } from "../../app/data";
export const useModel = () => useQuery("model.get", {} as never).data ?? null;
