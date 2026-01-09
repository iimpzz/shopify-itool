import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>商品导出工具</h1>
        <p className={styles.text}>
          用于导出店铺商品信息（支持导出商品描述 HTML、并可下载 Excel/JSON）。
        </p>
        <p className={styles.text}>
          运营同学请从 Shopify 后台左侧【应用】中打开本应用（无需在这里输入店铺域名）。
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>店铺域名（仅开发/管理员手动登录时需要）</span>
              <input
                className={styles.input}
                type="text"
                name="shop"
                placeholder="例如：auxito-2.myshopify.com"
              />
              <span>填写格式：xxx.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              登录
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>完整导出</strong>：自动分页导出大量商品（适合运营日常使用）。
          </li>
          <li>
            <strong>快速预览</strong>：快速导出前 250 条用于检查字段是否正确。
          </li>
          <li>
            <strong>Excel 输出</strong>：自动生成多工作表（商品/变体/图片）方便筛选统计。
          </li>
        </ul>
      </div>
    </div>
  );
}
