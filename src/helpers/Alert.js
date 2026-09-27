import $dev from "@/helpers/Dev";
import $appdata from "@/helpers/AppData";

export default {
  show(data, callback = function () {}) {
    data = this.getData(data);

    $dev.write("dialog", data, typeof data, Array.isArray(data));

    $appdata.set("alert.value", "");
    $appdata.set("alert.show", true);
    $appdata.set("alert.title", data.title || null);
    $appdata.set("alert.text", data.text || null);
    $appdata.set("alert.error", data.error || null);
    $appdata.set("alert.color", data.color || "");
    $appdata.set("alert.input", data.input === true);
    $appdata.set("alert.input_default", data.input_default ?? "");
    $appdata.set(
      "alert.translate",
      data.translate == null || data.translate == undefined
        ? true
        : data.translate
    );
    $appdata.set(
      "alert.buttons",
      data.buttons || [{ text: "alert.close", color: "error", value: "close" }]
    );

    let tmr = setInterval(function () {
      if (!$appdata.get("alert.show")) {
        clearInterval(tmr);
        callback($appdata.get("alert.value"));
      }
    }, 100);
  },

  yesno(data, callback = function () {}) {
    data = this.getData(data);

    this.show(
      {
        ...data,
        buttons: [
          { text: "alert.no", color: "error", value: "no" },
          { text: "alert.yes", color: "info", value: "yes" },
        ],
      },
      (resp, ret) => {
        callback(resp, ret);
      }
    );
  },

  info(data, callback = function () {}) {
    data = this.getData(data);

    this.show(
      {
        ...data,
        buttons: [{ text: "alert.close", color: "error", value: "close" }],
      },
      (resp, ret) => {
        callback(resp, ret);
      }
    );
  },

  error(data, callback = function () {}) {
    data = this.getData(data);

    this.show(
      {
        ...data,
        buttons: [{ text: "alert.close", color: "error", value: "close" }],
      },
      (resp, ret) => {
        callback(resp, ret);
      }
    );
  },

  // Diálogo com campo de texto — resolve com a string digitada (ou "" se
  // cancelado). `data.input_default` preenche o campo; `data.buttons` pode
  // customizar os botões, mas o botão de cancelar DEVE ter value:"cancel"
  // (é o que o Alert.vue usa pra saber que não deve devolver o texto digitado).
  prompt(data, callback = function () {}) {
    data = this.getData(data);

    this.show(
      {
        ...data,
        input: true,
        input_default: data.input_default ?? "",
        buttons: data.buttons || [
          { text: "alert.cancel", color: "error", value: "cancel" },
          { text: "alert.confirm", color: "info", value: "confirm" },
        ],
      },
      (resp) => {
        callback(resp === "cancel" ? "" : resp);
      }
    );
  },

  getData(data) {
    if (typeof data == "string") {
      data = { text: data };
    } else if (Array.isArray(data)) {
      data = {
        title: data[0] ?? null,
        text: data[1] ?? null,
      };
    }

    return data;
  },
};
