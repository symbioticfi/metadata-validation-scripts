import type { EntityType } from "../validate-fs";
import curators from "./curators.json";
import defaultSchema from "./info.json";
import points from "./points.json";

/**
 * Map of entity types to their JSON schemas
 */
const schemaMap: Partial<Record<EntityType, object>> = {
    points,
    curators,
};

/**
 * Get the JSON schema for a given entity type
 */
export const getSchema = (entityType: EntityType) => schemaMap[entityType] || defaultSchema;
