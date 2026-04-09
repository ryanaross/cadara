/**
 * Top-level protocol version shared across the current modeling boundary.
 * This is echoed on requests and responses so callers can reject unsupported
 * protocol families before attempting to interpret payload fields.
 */
export type ContractVersion = 'modeling-contract/v1alpha1'

/**
 * Document snapshot payload schema version.
 * This version applies only to `DocumentSnapshot` payload structure.
 */
export type SnapshotSchemaVersion = 'document-snapshot/v1alpha1'

/**
 * Feature authoring schema version.
 * This version applies to typed feature-definition variants.
 */
export type FeatureTypeVersion = 'feature-type/v1alpha1'

/**
 * Render export payload schema version.
 * This version applies only to renderer-neutral render export payloads.
 */
export type RenderExportSchemaVersion = 'render-export/v1alpha1'

/**
 * Current protocol version literal.
 */
export const CONTRACT_VERSION: ContractVersion = 'modeling-contract/v1alpha1'

/**
 * Current document snapshot schema version literal.
 */
export const SNAPSHOT_SCHEMA_VERSION: SnapshotSchemaVersion = 'document-snapshot/v1alpha1'

/**
 * Current feature type schema version literal.
 */
export const FEATURE_TYPE_VERSION: FeatureTypeVersion = 'feature-type/v1alpha1'

/**
 * Current render export schema version literal.
 */
export const RENDER_EXPORT_SCHEMA_VERSION: RenderExportSchemaVersion = 'render-export/v1alpha1'
