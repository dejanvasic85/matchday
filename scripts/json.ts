export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && value !== undefined && !Array.isArray(value) && Object(value) === value;
}
