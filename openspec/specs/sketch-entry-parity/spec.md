# sketch-entry-parity Specification

## Purpose

Define consistent sketch behavior across all supported entry points, including viewport selection, feature-tree selection, and reopened sketches.

## Requirements

### Requirement: Sketch behavior is consistent across entry points
The system MUST keep sketch behavior consistent whether the session was opened from a construction-plane selection, an existing sketch selection, or the feature tree.

#### Scenario: Compare viewport and feature-tree entry on the same plane
- **WHEN** the user opens sketches on the same primary plane from the viewport and from the feature tree
- **THEN** both sessions use the same active plane and author geometry with the same orientation

#### Scenario: Continue authoring after reopening a sketch
- **WHEN** the user reopens an existing sketch and authors additional geometry
- **THEN** the editor continues using the sketch's stored plane definition

### Requirement: Mixed planar targets follow the same sketch-open contract
The system MUST use the same sketch-open flow for datum planes, planar solid faces, and planar faces from other sketches.

#### Scenario: Start from a planar solid face
- **WHEN** the user activates `Sketch` and selects a planar solid face
- **THEN** the editor opens a sketch session using the selected face's plane support and the standard sketch-open contract

#### Scenario: Start from a planar face owned by another sketch
- **WHEN** the user activates `Sketch` and selects a planar face from another sketch
- **THEN** the editor opens a sketch session using that face's plane support and the standard sketch-open contract
