import { authenticate } from "../shopify.server";
import {
  VEHICLE_METAOBJECT_FIELD,
  VEHICLE_METAOBJECT_HANDLE,
  VEHICLE_METAOBJECT_TYPE,
  createDefaultVehicleConfig,
  normalizeVehicleConfig,
  validateVehicleConfig,
} from "../utils/vehicleConfig";

const GET_VEHICLE_METAOBJECT = `#graphql
  query GetVehicleMetaobject($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id
      handle
      type
      displayName
      fields {
        key
        value
        type
      }
      updatedAt
    }
  }
`;

const UPDATE_METAOBJECT = `#graphql
  mutation UpdateVehicleMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject {
        id
        handle
        updatedAt
        fields {
          key
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

function formatGraphQLErrors(errors) {
  return errors
    .map((error) => error.message || JSON.stringify(error))
    .join("; ");
}

export async function getVehicleConfig(request) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(GET_VEHICLE_METAOBJECT, {
    variables: {
      handle: {
        type: VEHICLE_METAOBJECT_TYPE,
        handle: VEHICLE_METAOBJECT_HANDLE,
      },
    },
  });

  const { data, errors } = await response.json();

  if (errors?.length) {
    throw new Error(formatGraphQLErrors(errors));
  }

  const metaobject = data?.metaobjectByHandle;

  if (!metaobject) {
    throw new Error(
      `Vehicle config metaobject not found for ${VEHICLE_METAOBJECT_TYPE}/${VEHICLE_METAOBJECT_HANDLE}.`,
    );
  }

  const vehicleField = metaobject.fields.find(
    (field) => field.key === VEHICLE_METAOBJECT_FIELD,
  );

  if (!vehicleField) {
    const knownFields = metaobject.fields
      .map((field) => `${field.key} (${field.type})`)
      .join(", ");

    throw new Error(
      `The "${VEHICLE_METAOBJECT_FIELD}" field is missing on ${VEHICLE_METAOBJECT_TYPE}/${VEHICLE_METAOBJECT_HANDLE}. Available fields: ${knownFields}`,
    );
  }

  let vehicleConfig = createDefaultVehicleConfig();

  if (vehicleField.value?.trim()) {
    try {
      vehicleConfig = JSON.parse(vehicleField.value);
    } catch (error) {
      throw new Error(`Vehicle JSON could not be parsed: ${error.message}`);
    }
  }

  const validation = validateVehicleConfig(vehicleConfig);

  return {
    metaobjectId: metaobject.id,
    handle: metaobject.handle,
    type: metaobject.type,
    jsonFieldKey: vehicleField.key,
    vehicleConfig: validation.normalized,
    rawValue: vehicleField.value || "",
    updatedAt: metaobject.updatedAt,
    allFields: metaobject.fields.map((field) => ({
      key: field.key,
      type: field.type,
    })),
    validation,
  };
}

export async function updateVehicleConfig(request, nextConfig) {
  const { admin } = await authenticate.admin(request);
  const currentConfig = await getVehicleConfig(request);
  const validation = validateVehicleConfig(nextConfig);

  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join(" "));
  }

  const payload = JSON.stringify(normalizeVehicleConfig(nextConfig), null, 2);

  const response = await admin.graphql(UPDATE_METAOBJECT, {
    variables: {
      id: currentConfig.metaobjectId,
      metaobject: {
        fields: [
          {
            key: VEHICLE_METAOBJECT_FIELD,
            value: payload,
          },
        ],
      },
    },
  });

  const { data, errors } = await response.json();

  if (errors?.length) {
    throw new Error(formatGraphQLErrors(errors));
  }

  const userErrors = data?.metaobjectUpdate?.userErrors || [];

  if (userErrors.length > 0) {
    throw new Error(
      userErrors
        .map((error) => `${error.field?.join(".") || "metaobject"}: ${error.message}`)
        .join("; "),
    );
  }

  return {
    success: true,
    metaobject: data?.metaobjectUpdate?.metaobject,
    updatedAt: data?.metaobjectUpdate?.metaobject?.updatedAt,
    validation,
  };
}
