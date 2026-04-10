## ADDED Requirements

### Requirement: Feature forms mark invalid fields with error styling
The system SHALL visually mark invalid feature form fields with red border and red text treatment while preserving non-error helper text for valid fields.

#### Scenario: Required reference is missing
- **WHEN** a feature form field requires a reference that has not been selected
- **THEN** the field is marked invalid with red border treatment and red error text describing the missing selection

#### Scenario: Numeric field has an invalid value
- **WHEN** a feature form numeric field contains a value that is invalid for the active feature draft
- **THEN** the field is marked invalid with red border treatment and red error text describing the invalid value

#### Scenario: Field is valid
- **WHEN** a feature form field has no field-level error
- **THEN** the field uses its normal non-error border and helper text treatment

### Requirement: Active reference pickers are visually distinct
The system SHALL visually denote the reference picker field currently collecting selections with the primary color.

#### Scenario: User activates a single-reference picker
- **WHEN** the user activates a single-reference picker in the feature form
- **THEN** that picker is marked as active with primary-color border and text treatment

#### Scenario: User activates a collection picker
- **WHEN** the user activates a reference collection picker in the feature form
- **THEN** that collection picker is marked as active with primary-color border and text treatment

#### Scenario: User switches active picker fields
- **WHEN** the user activates a different reference picker field in the same feature form
- **THEN** the newly activated picker receives the active primary-color treatment and the previously active picker returns to its normal treatment

### Requirement: Escape cancels active reference picking
The system SHALL cancel the active feature form reference-picking interaction when the user presses `Escape`.

#### Scenario: Escape during reference picking
- **WHEN** a feature form reference picker is active and the user presses `Escape`
- **THEN** the active picker state is cancelled and no field remains visually marked as actively selecting

#### Scenario: Escape clears picker-specific pending selection
- **WHEN** a feature form reference picker has pending picker-specific selection state and the user presses `Escape`
- **THEN** the pending picker-specific selection state is cleared without committing the feature session

#### Scenario: Escape with no active picker
- **WHEN** no feature form reference picker is active and the user presses `Escape`
- **THEN** the feature form does not perform picker-specific cancellation

### Requirement: Reference fields expose explicit clear controls
The system SHALL provide explicit delete or clear controls for feature form reference fields so users can remove selected references from the active draft.

#### Scenario: Clear a single-reference field
- **WHEN** a user clicks the clear control for a single-reference picker with a selected reference
- **THEN** the bound draft reference is set to `null` and the field displays its empty state

#### Scenario: Clear one reference from a collection field
- **WHEN** a user clicks the clear control for one selected reference in a reference collection field with multiple selected references
- **THEN** only that selected reference is removed from the bound draft reference collection and the other selected references remain selected

#### Scenario: Clear the last reference from a collection field
- **WHEN** a user clicks the clear control for the only selected reference in a reference collection field
- **THEN** that selected reference is removed and the field displays its empty state

#### Scenario: Clear control is disabled when no reference exists
- **WHEN** a reference picker field or a collection item has no selected reference
- **THEN** its clear control is disabled or hidden so it cannot dispatch a no-op destructive action
