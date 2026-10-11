import type { EntityType } from "../validate-fs";
import adapters from "./adapters.json";
import curators from "./curators.json";
import defaultSchema from "./info.json";
import merkleAdapters from "./merkle-adapters";
import points from "./points.json";

/**
 * Map of entity types to their JSON schemas
 */
const schemaMap: Partial<Record<EntityType, object>> = {
    points,
    curators,
    adapters,
    "merkle-adapters": merkleAdapters,
};

/**
 * Get the JSON schema for a given entity type
 */
export const getSchema = (entityType: EntityType) => schemaMap[entityType] || defaultSchema;
