# Conversation runtime

The runtime is what makes this product feel conversational rather than like search.

## Runtime goals

- Track the user's current issue.
- Remember facts collected in the current session.
- Avoid re-searching everything on every turn.
- Ask at most one useful follow-up question when confidence is not high.
- Convert repeated help sessions into known issues, FAQs, and ideas.

## Session state

```ts
type HelpSession = {
  conversationId: string;
  workspaceId: string;
  projectId?: string;
  detectedIntent?: HelpIntent;
  knownFacts: Record<string, unknown>;
  missingFacts: string[];
  evidenceRefs: string[];
  lastAnswer?: string;
  pendingActionIds?: string[];
};
```

## Intent types

- `crash_support`
- `performance_bottleneck`
- `install_help`
- `compatibility_question`
- `known_issue_check`
- `community_sentiment`
- `idea_pull`
- `idea_push`
- `reply_drafting`
- `announcement_drafting`
- `triage`

## Answer policy

### High confidence

Give concrete steps and evidence summary.

### Medium confidence

Give likely explanation, a short set of steps, and one follow-up question.

### Low confidence

Ask for the missing piece that will unlock the next step, such as platform, version, mod list, logs, or exact stage.

## Example: crash support

User:

```text
I'm crashing at the factory boss intro.
```

Runtime:

1. Classify as `crash_support`.
2. Extract stage and symptom.
3. Search connected Discord support, forums, Steam reviews, Reddit if relevant.
4. Cluster evidence.
5. Determine known issue or likely cause.
6. Answer with steps or ask one follow-up.
7. Suggest FAQ, issue draft, or known-issue post if repeated.

## Example: bottleneck check

User:

```text
Anyone else having CPU bottlenecks in the city after the patch?
```

Runtime:

1. Classify as `performance_bottleneck`.
2. Search recent sources.
3. Rank by recency, same version, and confirmations.
4. Return prevalence and likely affected setups.
5. Suggest a report template or poll.
