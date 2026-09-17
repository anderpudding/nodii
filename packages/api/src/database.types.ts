// 1단계에서 마이그레이션을 적용한 뒤 `pnpm db:types`로 덮어씁니다.
// (supabase gen types typescript --local)
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: { [_ in never]: never };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
