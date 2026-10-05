export type RoutingRule = {
  id: string;
  name?: string;
  enabled: boolean;
  matchers: { type: string; field?: string; value?: string }[];
  actions: { type: string; value?: string[] }[];
};

export const domain = "dnd.cspro.space";
export const worker = "batform-email-forwarder";

export function ruleBody(alias: { id: string; local_part: string }) {
  return {
    name: `BatMail/${alias.id}`,
    enabled: true,
    matchers: [{ type: "literal", field: "to", value: `${alias.local_part}@${domain}` }],
    actions: [{ type: "worker", value: [worker] }],
  };
}

export function ruleForAddress(rules: RoutingRule[], address: string) {
  return rules.find((rule) => rule.matchers.some((matcher) =>
    matcher.type === "literal" && matcher.field === "to" && matcher.value?.toLowerCase() === address.toLowerCase()
  ));
}

export function routesToWorker(rule: RoutingRule) {
  return rule.enabled && rule.actions.length === 1 && rule.actions[0].type === "worker" &&
    rule.actions[0].value?.length === 1 && rule.actions[0].value[0] === worker;
}
