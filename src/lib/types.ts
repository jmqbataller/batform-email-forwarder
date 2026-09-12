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
  original_from: string | null;
  original_to: string | null;
  masked_sender: string | null;
  subject: string | null;
  text_body: string | null;
  status: "processing" | "forwarded" | "blocked" | "failed";
  created_at: string;
};

export type InboxMessageRow = Pick<
  EmailEventRow,
  "id" | "original_from" | "subject" | "status" | "created_at"
> & {
  aliases: {
    local_part: string;
    label: string | null;
  };
};

export type InboxMessageDetail = EmailEventRow & {
  aliases: {
    local_part: string;
    label: string | null;
  };
};
