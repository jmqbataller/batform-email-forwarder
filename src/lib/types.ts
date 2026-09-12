export type AliasRow = {
  id: string;
  local_part: string;
  destination: string;
  label: string | null;
  enabled: boolean;
  forwarded_count: number;
  last_used_at: string | null;
  created_at: string;
};

export type EmailEventRow = {
  id: string;
  direction: "inbound" | "reply";
  masked_sender: string | null;
  subject: string | null;
  status: "processing" | "forwarded" | "blocked" | "failed";
  created_at: string;
};
