import VehicleImagesEditor, {
  headers,
} from "../components/VehicleImagesEditor";
import { authenticate } from "../shopify.server";
import {
  getVehicleConfig,
  updateVehicleConfig,
} from "../graphql/vehicleConfig.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  try {
    const config = await getVehicleConfig(request);
    return { config, error: null };
  } catch (error) {
    return {
      config: null,
      error: error.message || "加载 Vehicle 页面配置失败。",
    };
  }
};

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();

  try {
    if (formData.get("intent") !== "save") {
      return { success: false, error: "未知操作。" };
    }

    const payload = formData.get("vehicleConfig");

    if (typeof payload !== "string") {
      throw new Error("缺少 Vehicle 配置数据。");
    }

    const result = await updateVehicleConfig(request, JSON.parse(payload));

    return {
      success: true,
      error: null,
      updatedAt: result.updatedAt,
      validation: result.validation,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "保存 Vehicle 页面配置失败。",
    };
  }
};

export default VehicleImagesEditor;
export { headers };
