# Question Generation Guardrails

## Expansion Rule

The next 250 questions must not repeat the core concept already tested in the current 250-question bank unless the new question introduces a materially different implementation scenario, decision point, or failure mode.

## Protected Concept Clusters

These concepts are already dense enough that new questions should be blocked or heavily re-angled:

- OIR XML basics: syntax, context precedence, folder path algorithms, life cycle template assignment, team template assignment
- Team mechanics: shared teams, local teams, team instance construction, role-to-role mapping, team template update behavior
- Context definitions: product, library, project, organization, and send-to-PDM basics
- Promotion fundamentals: promotion request purpose, promotion roles, promotion workflow routing, promotion schemes
- Basic lifecycle comparisons: basic vs advanced life cycles, state-based versioning basics, standard transition types
- Access control fundamentals: ACL meaning, deny vs absolute deny, private domain basics, lifecycle access control limits
- CAD workspace basics: upload vs check-in, out-of-date status, workspace value, standard workspace actions
- Core change definitions: change notice purpose, redline basics, affected items, promotion request vs change notice
- Type and attribute fundamentals: reusable vs local vs calculated vs alias attributes, subtype inheritance, attribute visibility

## Preferred Expansion Areas

These areas appear in the manuals but are lightly covered or not directly tested in the current bank:

- Effectivity concepts and effectivity-based filtering
- Configuration specifications beyond the current baseline coverage
- Problem Report purpose and downstream progression
- Variance purpose and when it differs from issue reporting
- Change Task as discrete implementation work
- Content replication architecture
- Replica servers and replication rules
- Central vault versus replicated content
- Queue monitoring through JMX
- Throughput and security audit reporting
- Windchill Configuration Assistant usage
- Preference management beyond the current site-level/basic preference questions

## Writing Rules For New Questions

- Prefer scenario-based stems over direct-definition stems when the concept already appears adjacent to another topic in the bank.
- Keep distractors inside the Windchill ecosystem. Wrong answers should sound operationally plausible to a practitioner.
- Avoid repeating the exact actor/object pair already used in the current bank.
- Prefer single-answer questions in new batches unless a concept genuinely requires multi-response validation.
- If a new question touches a protected concept cluster, it must test a different nuance than the existing bank.
