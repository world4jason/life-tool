# Year Journey

## Purpose

A local-first Traditional Chinese reflection game linking events, hypotheses, alternative routes, experiments and feedback without ranking people or forcing goals.

## Requirements

### Requirement: Separate observation from interpretation
The system SHALL allow 0–3 major events per month and a separate recurring-background area. Energy MAY remain null; zero SHALL mean an explicit zero rating.

#### Scenario: Facts before feelings
- GIVEN an empty month
- WHEN a participant records a fact without rating energy
- THEN the event SHALL persist with null energy and SHALL NOT fabricate a zero point.

#### Scenario: Unfilled month
- GIVEN a month without recorded events
- WHEN the timeline renders
- THEN the system SHALL NOT fabricate an event or continuous psychological measurement.

### Requirement: Support provisional, bidirectional meaning-making
The system SHALL allow event selection followed by theme naming, or words followed by event association. Multiple themes MAY refer to the same event. Counterexamples and alternative interpretations SHALL be editable.

#### Scenario: Release a recurring theme
- GIVEN a theme inferred from past events
- WHEN a participant chooses to release it
- THEN the future direction SHALL NOT be required to reproduce that past theme.

### Requirement: Compare Options before commitment
The system SHALL offer add, reduce, different, maintain and pause route types, prompting alternative methods rather than only different frequencies. Selected routes SHALL have a recorded reason. Unselected alternatives SHALL be retained.

#### Scenario: Stress-test limited resources
- GIVEN weekly hours, monthly money and weekly energy budgets
- WHEN the half-time stress test is enabled
- THEN only available hours SHALL be halved temporarily; saved budgets SHALL remain unchanged.

#### Scenario: No new objective
- WHEN the participant chooses observation, skipping or no new goal
- THEN the system SHALL permit continuation and an optional written decision without a performance penalty.

### Requirement: Support plans in both directions
The system SHALL support objective/result/action hierarchy and grouping existing actions into a new objective. The tree SHALL reject cycles and nesting beyond eight levels.

#### Scenario: Group existing actions upward
- GIVEN recorded actions with feedback
- WHEN those actions are grouped under a new objective
- THEN their identifiers and existing feedback SHALL remain intact.

### Requirement: Distinguish measurement semantics
The system SHALL distinguish habits, experiences, outcomes, boundaries and routines; support at-least, at-most and exact comparators; support sum and latest-snapshot aggregation; and collect acceptance, trigger, minimum version, obstacle, fallback and review date.

#### Scenario: Minimum version is not full completion
- WHEN a participant logs a minimum version
- THEN its quantity SHALL remain separate from the full-completion quantity.

#### Scenario: No evidence of a boundary
- GIVEN no full or missed record in the applicable period
- WHEN an at-most target is evaluated
- THEN the result SHALL be unknown rather than successful.

### Requirement: Feedback evaluates execution and direction separately
The system SHALL collect numeric evidence independently from supports/unsure/drains direction feedback. Pause/stop choices SHALL update experiment status; adjust/reduce SHALL NOT silently invent replacement targets.

### Requirement: Preserve private local data and explicit recovery
The system SHALL separate fictional-demo and personal storage. It SHALL NOT upload reflections, track usage or load remote runtime dependencies. Private labels SHALL be described as masking, not encryption.

#### Scenario: Invalid import
- GIVEN existing saved content
- WHEN a malformed, oversized, unsupported or structurally invalid backup is selected
- THEN the original stored content SHALL remain unchanged.

#### Scenario: Conflicting tab or failed write
- WHEN another tab changes the stored snapshot or a write fails
- THEN the application SHALL warn, preserve current in-memory content and offer export rather than silently claiming successful persistence.

#### Scenario: Shareable SVG
- WHEN a map is exported
- THEN private events SHALL be excluded and the user SHALL be warned that manual theme/action text may still contain private information.

### Requirement: Touch and keyboard alternatives
The system SHALL provide non-drag interaction for every core task, native labeled dialogs, visible keyboard focus, reduced-motion support, and responsive desktop/mobile layouts with horizontal scrolling confined to the timeline where necessary.


## Requirement: Focused rating dialog

The reflective chapter SHALL open existing events in a score-first dialog with read-only fact metadata. Only monthly order MAY be edited within the fact summary. New events SHALL retain the full fact editor. Rating saves SHALL preserve omitted metadata, including origin and privacy.

### Scenario: Rate an existing event without rewriting its facts
- GIVEN an existing event with fact text and a selected origin
- WHEN opened from the reflective chapter
- THEN the score and enabled slider are visible without initial scrolling at supported viewports
- AND the month, title, facts, origin and privacy are shown as static content, not editable inputs
- AND saving changes only the chosen reflective fields and optional monthly order

### Scenario: Distinguish unrated from zero
- GIVEN an unrated event
- WHEN the rating dialog is opened and saved without score interaction
- THEN its energy remains null
- WHEN the slider is moved or the user explicitly chooses zero
- THEN the score readout and persisted value reflect that choice
- AND opting out restores null without preventing later slider use

## Requirement: Single-choice origin tags

The fact editor SHALL present the existing origin enum as four native radio tags, with keyboard navigation and visible selected/focus states. Rating summaries SHALL show only the selected origin as a static tag. No schema migration is required.

### Scenario: Select an origin by keyboard or touch
- GIVEN the event fact editor
- WHEN a player selects planned, surprise, mixed or unsure
- THEN exactly one origin remains selected and is saved using its existing enum value
- AND each tag has a touch target at least 44 CSS px high
