import $dev from "@/helpers/Dev";
import $appdata from "@/helpers/AppData";

export default {
  open(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    $dev.write("open", id);
    // setMultiple: uma única mensagem IPC com os dois campos (ver minimize()
    // sobre por que isso importa).
    $appdata.setMultiple([
      [`modules.${id}.show`, true],
      // Reabrir (ex.: clique no ícone da tray) sai do estado "minimizado" —
      // ver comentário em minimize() sobre por que esse campo existe.
      [`modules.${id}.minimized`, false],
    ]);
  },
  close(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    $dev.write("close", id);
    // Fechar de vez (diferente de minimizar) — qualquer módulo com janela de
    // saída (ex. video_player) que use "show || minimized" pra decidir se
    // deve continuar ativo na projeção precisa que os dois virem false aqui,
    // senão o close nunca encerra a projeção depois de um minimize anterior.
    // setMultiple: uma única mensagem IPC com os dois campos.
    $appdata.setMultiple([
      [`modules.${id}.show`, false],
      [`modules.${id}.minimized`, false],
    ]);

    //Remove da TrayArea
    this.removeTray(id);
  },
  minimize(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    if ($appdata.get(`modules.${id}.title`, "") == "") {
      console.error(`Módulo ${id} não possui a prorpiedade "title"!`);
      return;
    }
    if ($appdata.get(`modules.${id}.icon`, "") == "") {
      console.error(`Módulo ${id} não possui a prorpiedade "icon"!`);
      return;
    }
    $dev.write("minimize", id);
    // "minimized" (distinto de "show") existe pra módulos com janela de saída
    // continuarem ativos na projeção mesmo com o painel do operador escondido
    // — ver modules.video_player.minimized em video_player/interface/Popup.vue.
    // setMultiple (não dois set() separados): garante que "minimized" e
    // "show" cheguem juntos na janela de saída numa ÚNICA mensagem IPC. Com
    // dois set() sequenciais, cada campo vira uma mensagem própria — nesse
    // intervalo entre as duas, o "isActive" (show || minimized) de lá podia
    // computar um valor incorreto por um instante (ambos false), disparando
    // o fade de fechamento (vídeo saía da projeção/ficava mudo) só por causa
    // do minimizar, sem o operador ter pedido isso.
    $appdata.setMultiple([
      [`modules.${id}.minimized`, true],
      [`modules.${id}.show`, false],
    ]);

    //Adiciona na TrayArea
    this.addTray(id);
  },
  get(list = null) {
    if (list == null) {
      return $appdata.get("modules");
    }

    if (typeof list == "string") {
      return $appdata.get(`modules.${list}`);
    }

    if (!list || list.length <= 0) {
      return {};
    }

    try {
      return {
        ...Object.fromEntries(
          list.map((module) => {
            return [
              module,
              { id: module, ...$appdata.get(`modules.${module}`) } || {
                invalid: true,
                title: "modules.invalid.title",
                icon: "mdi-alert-circle-outline",
              },
            ];
          })
        ),
      };
    } catch (e) {
      return {};
    }
  },
  addTray(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    $appdata.addElement(`tray_area.modules`, id);
  },
  removeTray(id) {
    if (!this.check(id)) {
      console.error(`Módulo ${id} não encontrado!`);
      return;
    }
    $appdata.removeElement(`tray_area.modules`, id);
  },
  getTray() {
    return this.get($appdata.get("tray_area.modules"));
  },
  setTray(data) {
    return $appdata.set("tray_area.modules", data);
  },

  getMenu() {
    return this.get($appdata.get("menu.modules"));
  },

  getGroups() {
    const module_group = JSON.parse(
      JSON.stringify($appdata.get("module_group") || {})
    );
    Object.keys(module_group).forEach((key) => {
      if (module_group[key].modules?.length <= 0) {
        module_group[key].modules = {};
      }

      module_group[key].modules = this.get(module_group[key].modules || []);
    });
    return module_group;
  },

  check(id) {
    return $appdata.exists(`modules.${id}`);
  },

  sort(modules, $t) {
    return Object.entries(modules)
      .sort(([, v1], [, v2]) => {
        const t1 = v1?.title ? $t(v1.title).toLowerCase() : "";
        const t2 = v2?.title ? $t(v2.title).toLowerCase() : "";
        return t1.localeCompare(t2);
      })
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
  },
};
