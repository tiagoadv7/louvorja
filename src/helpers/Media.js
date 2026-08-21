import $dev from "@/helpers/Dev";
import $appdata from "@/helpers/AppData";
import $userdata from "@/helpers/UserData";
import $datetime from "@/helpers/DateTime";
import $path from "@/helpers/Path";
import $alert from "@/helpers/Alert";
import $modules from "@/helpers/Modules";
import $database from "@/helpers/Database";
import $electron from "@/helpers/Electron";
import $audioBus from "@/helpers/AudioBus";

const Media = {
  async open(params) {
    // typeof null === "object" — sem o check explícito, open(null) (ex.: retry
    // do alerta "não carregou" quando modules.media.id_music ainda não tinha
    // sido definido) passava batido aqui e travava mais abaixo tentando ler
    // params.id_music de um params que continuava null.
    if (typeof params != "object" || params === null) {
      params = { id_music: params };
    }

    $dev.write("open media", params);

    // Conexão remota está ativada? Se sim, abre do programa desktop
    if ($userdata.get("remote.is_connected")) {
      const tag =
        params.mode == "audio" ? 1 : params.mode == "instrumental" ? 2 : 3;

      const url =
        $userdata.get("remote.url") +
        "/api/open-song?id=" +
        params.id_music +
        "&tag=" +
        tag +
        "&token=" +
        $userdata.get("remote.token");

      $alert.info("modules.media.alerts.open_remote");
      try {
        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
        });

        const ret = await response.json();
        if (ret.status != "ok") {
          $alert.error({
            text:
              ret.code == "INVALID_TOKEN"
                ? "modules.remote_control.messages.invalid_token"
                : "modules.remote_control.messages.error",
            error: ret.code,
          });
        }
      } catch (error) {
        $alert.error({
          text: "modules.media.alerts.open_remote_error",
          error: error,
        });
      }
      return;
    }

    // Troca de modo (cantado ↔ playback) na mesma música → crossfade, sem reiniciar
    const _currentId = $appdata.get("modules.media.id_music");
    const _currentMode = $appdata.get("modules.media.config.mode");
    if (
      params.id_music === _currentId && _currentId != null &&
      params.mode !== _currentMode &&
      (params.mode === "audio" || params.mode === "instrumental") &&
      (_currentMode === "audio" || _currentMode === "instrumental")
    ) {
      this.switchMode(params.mode);
      return;
    }

    const _newMode = params.mode || "no_audio";
    if (_newMode === "audio" || _newMode === "instrumental") {
      // Avisa outros donos de áudio (soundmaster, video_player) para pararem com fade
      $audioBus.requestFocus("media");
    }

    // Reabertura do MESMO slide/música já ativa (ex.: clique duplo acidental no
    // slide do álbum): antes de decidir o que fazer, limpa qualquer resíduo de
    // uma transição anterior que tenha sido interrompida no meio — sem isso, um
    // elemento <audio id="__audio_xfade"> de uma tentativa de crossfade abortada
    // (setInterval do fade-in que nunca chegou a promover nem a ser pausado)
    // ficava tocando escondido para sempre em segundo plano. A reabertura em si
    // continua fazendo crossfade normalmente (ver _willCrossfade abaixo) — só o
    // lixo de uma transição anterior é removido aqui.
    const _isSameTrackReopen =
      params.id_music === _currentId && _currentId != null &&
      params.mode === _currentMode &&
      (params.mode === "audio" || params.mode === "instrumental");
    if (_isSameTrackReopen) {
      this._killCrossfade({ keepMain: true });
    }

    // Crossfade: se já havia áudio tocando e a nova abertura também produz áudio,
    // faz um crossfade real (ver _crossfadeAudioTrack) em vez de cortar na hora —
    // por isso NÃO chama stopAudio()/_detachAndFadeOut() aqui: o áudio atual continua
    // tocando normalmente durante a busca assíncrona da nova música; o crossfade só
    // começa lá embaixo, no ponto exato em que a nova URL de áudio está pronta.
    // this._crossfading também bloqueia checkTime()/_onAudioEnded()/timeUpdate() de
    // reagirem ao elemento antigo (que ainda gera eventos) enquanto a troca ocorre.
    // Reabrir a MESMA música/modo que já está tocando também entra aqui: o resultado
    // é o crossfade terminar suave a instância anterior e reiniciar do zero (currentTime=0
    // em _crossfadeAudioTrack), em vez de cortar seco.
    const _wasPlayingAudio = !$appdata.get("modules.media.config.is_paused") &&
      ["audio", "instrumental"].includes($appdata.get("modules.media.config.mode"));
    const _willCrossfade = _wasPlayingAudio && (_newMode === "audio" || _newMode === "instrumental");
    this._crossfading = _willCrossfade;
    if (!_willCrossfade) {
      this.stopAudio();
    }

    const id_music = params.id_music;
    const minimized = params.minimized ? params.minimized : false;
    const id_album = params.id_album ? params.id_album : null;
    let mode = _newMode;

    $appdata.set("modules.media.loading", true);

    let data = await $database.get(`music_${id_music}`);
    if (data == null) {
      this._crossfading = false;
      if (typeof this._autoCloseCallback === 'function') {
        // Modo "reproduzir todos": pula para a próxima faixa silenciosamente
        this._autoCloseCallback();
      } else {
        // Modo single: sugere download se offline
        if ($database.isLocalEnabled()) {
          window.dispatchEvent(
            new CustomEvent('open-download-center', { detail: { section: 'collections' } })
          );
        }
        this.close(true);
      }
      return;
    }
    await this.resolveDataImages(data);

    // Precarrega a imagem do slide capa no cache do browser (elimina tela preta inicial).
    // Se o arquivo estiver local o protocolo app-local:// o serve em ms; se não estiver,
    // busca da API em background — em ambos os casos a imagem já está pronta ao renderizar.
    await this.preloadImage(data.url_image);

    // Precarrega imagens dos demais slides sem bloquear (evita flash ao navegar).
    {
      const _seen = new Set([data.url_image || '']);
      for (const s of Object.values(data?.lyric || data?.slides || {})) {
        if (s.url_image && !_seen.has(s.url_image)) {
          _seen.add(s.url_image);
          this.preloadImage(s.url_image);
        }
      }
    }

    // Lote atômico: título/imagem/slides da música ANTERIOR só saem de cena no mesmo
    // instante em que os da NOVA música entram — a janela de saída nunca recebe um
    // estado intermediário "vazio" (era isso que causava o fundo preto entre uma
    // faixa e outra no "Reproduzir todos": clearVariables() antigo usava vários
    // $appdata.set() individuais, cada um virando uma mensagem IPC própria).
    const computedSlides = this.slides(data);
    const batch = [
      ["modules.media.data", data],
      ["modules.media.id_music", id_music],
      ["modules.media.id_album", id_album],
      ["modules.media.config.title", data.name],
      ["modules.media.config.slide_index", 0],
      ["modules.media.config.last_slide", computedSlides.length],
      ["modules.media.times", []],
      ["modules.media.config.audio", ""],
      ["modules.media.config.lazy", false],
      ["modules.media.config.current_time", 0],
      ["modules.media.config.duration", 0],
      ["modules.media.config.progress", 0],
      ["modules.media.config.slide_progress", 0],
      ["modules.media.config.buffered", 0],
      ["modules.media.config.volume", 100],
      ["modules.media.config.is_fading", false],
    ];
    this.setAlbumInfo(id_album, "media", data, batch);
    $appdata.setMultiple(batch);

    if (minimized) {
      this.minimize();
    } else {
      this.maximize();
    }

    if (mode == "audio" || mode == "instrumental") {
      //Será executado com áudio... cria o elemento de audio (a menos que seja
      // crossfade: aí o elemento atual continua tocando intocado até o ponto exato
      // de início do crossfade, mais abaixo — ver _crossfadeAudioTrack)
      let audio = null;
      if (!_willCrossfade) {
        audio = this.getElement();
        const volume = $appdata.get("modules.media.config.volume");
        audio.volume = volume / 100;

        this.pause(true);
        audio.currentTime = 0;
      }

      //Grava os tempos dos slides
      const openTimes = this.slides().map((item) =>
        $datetime.toNumber(
          mode == "audio" ? item.time : item.instrumental_time,
        ),
      );
      // Se o modo escolhido não tiver marcações válidas (todas 0), cai para
      // "time" — sem isso o slide pula direto para o último assim que o
      // áudio começa (mesma proteção já aplicada em switchMode()).
      $appdata.set(
        "modules.media.times",
        openTimes.some((t) => t > 0)
          ? openTimes
          : this.slides().map((item) => $datetime.toNumber(item.time)),
      );

      const rawUrl = mode == "audio" ? data.url_music : data.url_instrumental_music;
      const localUrl = await $electron.mediaResolveFile(rawUrl);
      $appdata.set("modules.media.config.audio", localUrl || $path.file(rawUrl));

      // Arquivo ainda não baixado, app em Modo Offline e com internet disponível →
      // pergunta a preferência (baixar a música, baixar o álbum inteiro, ou só
      // tocar online desta vez) em vez de só oferecer "Baixar Álbum" (comportamento
      // antigo, ainda usado como fallback abaixo quando não há internet).
      // Em Modo Online o app já assume que vai buscar tudo sob demanda — toca direto,
      // sem perguntar (params._skipOnlineChoice evita perguntar de novo após a escolha).
      // Depende só do ÁUDIO ter sido encontrado localmente (!localUrl) — a imagem de
      // capa é irrelevante pra decidir se dá pra tocar o som; antes essa condição
      // também exigia a capa estar ausente localmente, o que fazia essa pergunta
      // nunca aparecer pra músicas sem capa própria (conta como "encontrada" por
      // definição) ou com a capa cacheada de outra música do mesmo álbum, mesmo
      // com o áudio de fato não encontrado.
      const isOfflineMode = $database.isLocalEnabled();
      const hasInternet = typeof navigator === "undefined" || navigator.onLine;
      if (!localUrl && rawUrl && !params._skipOnlineChoice && isOfflineMode && hasInternet
        && typeof this._autoCloseCallback !== 'function') {
        this._crossfading = false;
        $appdata.set("modules.media.config.mode", mode);
        $appdata.set("modules.media.loading", false);
        const albumEntry = data.albums?.length > 0
          ? (id_album ? data.albums.find((x) => x.id_album == id_album) : null) || data.albums[0]
          : null;

        window.dispatchEvent(
          new CustomEvent("media-play-choice", {
            detail: {
              onChoice: async (val) => {
                if (val === "cancel") return;
                if (val === "download_album") {
                  window.dispatchEvent(
                    new CustomEvent("open-download-center", {
                      detail: { section: "collections", id_album, albumName: albumEntry?.name || "" },
                    })
                  );
                  return;
                }
                if (val === "download_song") {
                  const downloaded = await $electron.mediaDownloadFile({
                    url: rawUrl,
                    albumName: albumEntry?.name || null,
                    filesBaseUrl: import.meta.env.VITE_URL_FILES,
                    token: import.meta.env.VITE_API_TOKEN,
                  });
                  if (!downloaded) {
                    $alert.error({ text: "modules.media.alerts.not_loaded" });
                    return;
                  }
                }
                // "online" ou música baixada agora: (re)abre já sem perguntar de novo
                this.open({ ...params, _skipOnlineChoice: true });
              },
            },
          })
        );
        return;
      }

      // Arquivo local não encontrado (sem internet, ou fora do Modo Offline) → oferecer
      // download ao invés de tentar carregar e falhar. Mesma regra acima: depende só
      // do áudio, não da imagem de capa.
      if (!localUrl && rawUrl && rawUrl.startsWith("app-local://")) {
        this._crossfading = false;
        $appdata.set("modules.media.config.mode", mode);
        $appdata.set("modules.media.loading", false);
        if (typeof this._autoCloseCallback === 'function') {
          // Modo "reproduzir todos": pula para a próxima faixa silenciosamente
          this._autoCloseCallback();
          return;
        }
        // Modo single: mostra alerta com opção de download
        const albumName = (() => {
          if (data.albums?.length > 0) {
            const a = id_album ? data.albums.find((x) => x.id_album == id_album) : null;
            return (a || data.albums[0])?.name || "";
          }
          return "";
        })();
        $alert.show(
          {
            title: "modules.media.alerts.not_loaded_offline",
            text: "modules.media.alerts.not_loaded_offline_detail",
            color: "warning",
            translate: true,
            buttons: [
              { text: "alert.close", color: "grey", value: "close" },
              { text: "modules.media.alerts.btn_download", color: "primary", value: "download" },
            ],
          },
          function (val) {
            if (val === "download") {
              window.dispatchEvent(
                new CustomEvent("open-download-center", {
                  detail: { section: "collections", id_album, albumName },
                })
              );
            }
          }
        );
        return;
      }

      // Arquivo local encontrado ou lazy_load ativo: reproduz direto (sem XHR)
      if (
        localUrl ||
        ($appdata.get("is_online") && $userdata.get("modules.media.lazy_load"))
      ) {
        $appdata.set("modules.media.config.lazy", true);
        const audioUrl = $appdata.get("modules.media.config.audio");
        $appdata.set("modules.media.loading", false);
        if (_willCrossfade) {
          this._crossfadeAudioTrack(audioUrl, $appdata.get("modules.media.config.volume") / 100);
        } else {
          audio.src = audioUrl;
          audio.load();
          this.play();
        }
      } else {
        //Se a opção lazy_load estiver desmarcada, execução lenta (o audio só é executado depois de totalmente carregado)
        $appdata.set("modules.media.config.lazy", false);
        let self = this;
        let request = new XMLHttpRequest();
        try {
          request.open("GET", $appdata.get("modules.media.config.audio"), true);
        } catch (error) {
          self._crossfading = false;
          if (typeof self._autoCloseCallback === 'function') {
            self._autoCloseCallback();
          } else {
            $alert.error(
              { text: "modules.media.alerts.not_loaded", error },
              function (a) {
                if (a) { self.open(id_music); }
              },
            );
          }
          return;
        }

        request.responseType = "blob";
        request.onload = function () {
          if (this.status == 200) {
            const blobUrl = URL.createObjectURL(this.response);
            if (_willCrossfade) {
              self._crossfadeAudioTrack(blobUrl, $appdata.get("modules.media.config.volume") / 100);
            } else {
              audio.src = blobUrl;
              audio.load();
              self.play();
            }
          } else {
            self._crossfading = false;
            if (typeof self._autoCloseCallback === 'function') {
              self._autoCloseCallback();
            } else {
              $alert.error(
                {
                  text: "modules.media.alerts.not_loaded",
                  error: request.statusText || "",
                },
                function (a) {
                  if (a) { self.open(id_music); }
                },
              );
            }
          }
        };
        request.onerror = function () {
          self._crossfading = false;
          if (typeof self._autoCloseCallback === 'function') {
            self._autoCloseCallback();
          } else {
            $alert.error(
              {
                text: "modules.media.alerts.not_loaded",
                error: request.statusText || "",
              },
              function (a) {
                if (a) { self.open(id_music); }
              },
            );
          }
        };

        request.send();
        $appdata.set("modules.media.loading", false);
      }
    } else {
      $appdata.set("modules.media.config.audio", "");
      $appdata.set("modules.media.loading", false);
    }

    $appdata.set("modules.media.config.mode", mode);
  },

  async switchMode(newMode, skipChoice = false) {
    const data = $appdata.get("modules.media.data");
    if (!data) return;

    const audio = this.getElement();
    const capturedTime = audio.currentTime;
    const targetVolume = $appdata.get("modules.media.config.volume") / 100;
    const isPaused = $appdata.get("modules.media.config.is_paused") || audio.paused;

    const rawSwitchUrl = newMode === "audio" ? data.url_music : data.url_instrumental_music;
    const localUrl = await $electron.mediaResolveFile(rawSwitchUrl);
    const newUrl = localUrl || $path.file(rawSwitchUrl);

    // Mesmo tratamento do open(): Modo Offline + internet + arquivo (cantado/playback)
    // ainda não baixado → pergunta a preferência em vez de só oferecer "Baixar Álbum".
    const isOfflineMode = $database.isLocalEnabled();
    const hasInternet = typeof navigator === "undefined" || navigator.onLine;
    if (!localUrl && rawSwitchUrl && !skipChoice && isOfflineMode && hasInternet) {
      const id_album = $appdata.get("modules.media.id_album");
      const albumEntry = data.albums?.length > 0
        ? (id_album ? data.albums.find((x) => x.id_album == id_album) : null) || data.albums[0]
        : null;

      window.dispatchEvent(
        new CustomEvent("media-play-choice", {
          detail: {
            onChoice: async (val) => {
              if (val === "cancel") return;
              if (val === "download_album") {
                window.dispatchEvent(
                  new CustomEvent("open-download-center", {
                    detail: { section: "collections", id_album, albumName: albumEntry?.name || "" },
                  })
                );
                return;
              }
              if (val === "download_song") {
                const downloaded = await $electron.mediaDownloadFile({
                  url: rawSwitchUrl,
                  albumName: albumEntry?.name || null,
                  filesBaseUrl: import.meta.env.VITE_URL_FILES,
                  token: import.meta.env.VITE_API_TOKEN,
                });
                if (!downloaded) {
                  $alert.error({ text: "modules.media.alerts.not_loaded" });
                  return;
                }
              }
              // "online" ou música baixada agora: troca de modo já sem perguntar de novo
              this.switchMode(newMode, true);
            },
          },
        })
      );
      return;
    }

    // Arquivo local não encontrado (sem internet, ou Modo Online) → aviso antigo
    if (!localUrl && rawSwitchUrl && rawSwitchUrl.startsWith("app-local://")) {
      $alert.show(
        {
          title: "modules.media.alerts.not_loaded_offline",
          text: "modules.media.alerts.not_loaded_offline_detail",
          color: "warning",
          translate: true,
          buttons: [
            { text: "alert.close", color: "grey", value: "close" },
            { text: "modules.media.alerts.btn_download", color: "primary", value: "download" },
          ],
        },
        function (val) {
          if (val === "download") {
            window.dispatchEvent(
              new CustomEvent("open-download-center", {
                detail: {
                  section: "collections",
                  id_album: $appdata.get("modules.media.id_album"),
                },
              })
            );
          }
        }
      );
      return;
    }

    const newTimes = this.slides().map((item) =>
      $datetime.toNumber(newMode === "audio" ? item.time : item.instrumental_time)
    );
    // Só substitui os tempos se o novo modo tiver marcações válidas.
    // Sem isso, ao mudar para playback sem tempos definidos todos ficam em 0
    // e o slide pula direto para o último.
    if (newTimes.some(t => t > 0)) {
      $appdata.set("modules.media.times", newTimes);
    }
    $appdata.set("modules.media.config.mode", newMode);
    $appdata.set("modules.media.config.audio", newUrl);

    // Cancela fadeIn/fadeOut em andamento e captura a chave desta transição
    this._fadeKey = (this._fadeKey || 0) + 1;
    if (this._pauseInterval) { clearInterval(this._pauseInterval); this._pauseInterval = null; }
    if (!this._fades) this._fades = {};
    clearInterval(this._fades.xfade_out);
    clearInterval(this._fades.xfade_in);
    const xfadeKey = this._fadeKey;

    if (isPaused) {
      // audio.load() zera currentTime e dispara progress/timeupdate com tempo 0
      // antes do canplay/seek abaixo — sem bloquear timeUpdate() aqui, o slide_index
      // é recalculado para o início nesse meio-tempo (mesma causa já documentada
      // no comentário da promoção do xfade, linha ~555). _crossfading suprime
      // timeUpdate()/checkTime() até o seek para capturedTime se completar, e então
      // recalculamos manualmente com o tempo já correto.
      this._crossfading = true;
      audio.src = newUrl;
      audio.volume = targetVolume;
      audio.addEventListener("canplay", () => {
        audio.currentTime = capturedTime;
        this._crossfading = false;
        this.timeUpdate();
      }, { once: true });
      audio.load();
      return;
    }

    audio.volume = targetVolume;
    $appdata.set("modules.media.config.is_fading", true);

    // Mesmo motivo do ramo isPaused acima: "times" já foi trocado pro modo
    // NOVO (linha ~518), mas o áudio ANTIGO continua tocando (e disparando
    // timeupdate/progress) até a promoção do xfade, mais abaixo. Sem
    // suprimir timeUpdate()/checkTime() aqui, o slide_index era recalculado
    // usando os tempos do modo NOVO contra o currentTime do áudio ANTIGO
    // (ainda na linha do tempo do modo velho) — fazendo o slide saltar pra
    // frente (ou pra trás) durante os ~1.2s do crossfade, até a promoção lá
    // embaixo corrigir sozinha no próximo timeupdate natural.
    this._crossfading = true;

    const existing = document.getElementById("__audio_xfade");
    if (existing) { existing.pause(); existing.remove(); }

    const xfade = document.createElement("audio");
    xfade.id = "__audio_xfade";
    xfade.preload = "auto";
    xfade.volume = 0;
    xfade.src = newUrl;
    document.body.appendChild(xfade);

    xfade.addEventListener("canplay", () => {
      if (this._fadeKey !== xfadeKey) {
        xfade.pause(); xfade.src = ""; xfade.remove();
        return;
      }

      // Sincroniza posição com o audio atual
      xfade.currentTime = audio.currentTime;
      xfade.play().catch(() => {});

      // Padrão SoundMaster: dois fades independentes com slots nomeados, 40 ms/passo
      const FADE_MS = 1200;
      const INTERVAL = 40;
      const steps = Math.max(1, Math.round(FADE_MS / INTERVAL));

      // FADE OUT — audio antigo sai de forma independente
      const outStart = audio.volume;
      const outD     = outStart / steps;
      let outN = 0;
      this._fades.xfade_out = setInterval(() => {
        if (this._fadeKey !== xfadeKey) { clearInterval(this._fades.xfade_out); return; }
        outN++;
        audio.volume = Math.max(0, outStart - outD * outN);
        if (outN >= steps) { clearInterval(this._fades.xfade_out); audio.volume = 0; audio.pause(); }
      }, INTERVAL);

      // FADE IN — xfade entra de forma independente; ao terminar, transfere para audio
      const inD = targetVolume / steps;
      let inN = 0;
      this._fades.xfade_in = setInterval(() => {
        if (this._fadeKey !== xfadeKey) { clearInterval(this._fades.xfade_in); return; }
        inN++;
        xfade.volume = Math.min(targetVolume, inD * inN);
        if (inN >= steps) {
          clearInterval(this._fades.xfade_in);
          clearInterval(this._fades.xfade_out);
          xfade.volume = targetVolume;

          // Promove xfade para elemento principal — sem reload nem seek.
          // audio.load() causava: timeupdate com currentTime=0 → slide de título,
          // e play() antes do seek completar → engasgo/gargalo.
          audio.pause();
          audio.src = "";
          audio.removeAttribute("id");

          xfade.id = "__audio";
          xfade.setAttribute("preload", "auto");
          xfade.setAttribute("autoplay", "true");
          xfade.addEventListener("timeupdate", this.timeUpdate.bind(this));
          xfade.addEventListener("progress", this.timeUpdate.bind(this));
          xfade.addEventListener("ended", this._onAudioEnded.bind(this));

          audio.remove();
          $appdata.set("modules.media.config.is_fading", false);

          // Libera timeUpdate()/checkTime() (ver _crossfading = true acima) e
          // recalcula o slide_index já com o áudio novo — sem isso o slide
          // ficava travado na posição de antes do crossfade até o próximo
          // timeupdate natural do elemento recém-promovido.
          this._crossfading = false;
          this.timeUpdate();
        }
      }, INTERVAL);
    }, { once: true });

    xfade.load();
  },

  close(force = false) {
    //Se force for true, fechamento forçado. Sem diálogo de confirmação!
    if (!force) {
      const self = this;
      $alert.yesno("modules.media.alerts.close", function (btn) {
        if (btn == "yes") {
          self.close(true);
        }
      });
      return;
    }

    // stopAudio() só chama de volta depois que o áudio de fato silenciou (fade real
    // quando "Efeito de Fade" está ligado) — só então o slide some da tela. Sem
    // esperar isso, o slide desaparecia (fade visual de ~0.5s) enquanto o áudio
    // ainda tocava em fade por mais ~0.7s, dessincronizado (tela em branco com som).
    this.stopAudio(() => {
      // setMultiple: uma única mensagem IPC com os dois campos (evita estado
      // combinado intermediário incorreto do lado da janela de saída).
      $appdata.setMultiple([
        ["modules.media.show", false],
        ["modules.media.minimized", false],
      ]);
      // show=false e minimized=false tiram a projeção do modo ativo (Popup.vue do módulo
      // media passa a renderizar em standby/transparente), mas a janela de saída permanece
      // aberta até o operador clicar em "Parar projeção". Os dados do slide ficam intactos
      // (reabertura rápida via F5) — só são substituídos no próximo open().
    });
  },

  // Chamado quando o áudio termina naturalmente (fim da música ou dos slides).
  // Diferente de close(): para o áudio e oculta o módulo no app. show=false e
  // minimized=false colocam a projeção em standby (transparente), mas a janela de
  // saída continua aberta até o operador encerrar a projeção manualmente.
  endSong() {
    // Mesmo motivo do close(): só esconde o slide depois que o áudio (fade real,
    // se habilitado) já silenciou de verdade.
    this.stopAudio(() => {
      $appdata.setMultiple([
        ["modules.media.show", false],
        ["modules.media.minimized", false],
      ]);
      // Não chama closeOutput() — dados preservados para reabertura rápida; a janela
      // de saída permanece aberta (modo de projeção ativo).
    });
  },

  async openLyric(params) {
    if (params == null || params == undefined) {
      params = {
        id_music: $appdata.get("modules.media.id_music"),
        id_album: $appdata.get("modules.media.id_album"),
      };
    } else if (typeof params != "object") {
      params = { id_music: params };
    }
    $dev.write("open lyric", params);

    const id_music = params.id_music;
    const id_album = params.id_album ? params.id_album : null;

    $appdata.set("modules.lyric.loading", true);

    let data = await $database.get(`music_${id_music}`);
    if (data == null) {
      this.closeLyric();
      return;
    }
    await this.resolveDataImages(data);
    await this.preloadImage(data.url_image);
    {
      const _seen = new Set([data.url_image || '']);
      for (const s of Object.values(data?.lyric || data?.slides || {})) {
        if (s.url_image && !_seen.has(s.url_image)) {
          _seen.add(s.url_image);
          this.preloadImage(s.url_image);
        }
      }
    }
    $appdata.set("modules.lyric.data", data);

    $appdata.set("modules.lyric.id_music", id_music);
    $appdata.set("modules.lyric.id_album", id_album);
    $appdata.set("modules.lyric.config.title", data.name);

    this.setAlbumInfo(id_album, "lyric");

    $appdata.set("modules.lyric.show", true);
    $appdata.set("modules.lyric.loading", false);
  },
  closeLyric() {
    $dev.write("close lyric");
    $appdata.set("modules.lyric.show", false);

    $appdata.set("modules.lyric.data", {});
    $appdata.set("modules.lyric.id_music", null);
    $appdata.set("modules.lyric.id_album", null);
    $appdata.set("modules.lyric.config.title", null);
    $appdata.set("modules.lyric.loading", false);
  },

  async openAlbum(id_album) {
    $dev.write("open album", id_album);

    $appdata.set("modules.album.loading", true);

    let data = await $database.get(`album_${id_album}`);
    if (data == null) {
      // Modo offline ativo mas álbum não baixado → abre o Download Center (Coletâneas)
      if ($database.isLocalEnabled()) {
        window.dispatchEvent(
          new CustomEvent('open-download-center', { detail: { section: 'collections' } })
        );
      }
      this.closeAlbum();
      return;
    }
    if (data.url_image) {
      data.url_image = await this.resolveImageUrl(data.url_image);
    }
    $appdata.set("modules.album.data", data);

    let hymnal = data.categories.filter((item) =>
      item.startsWith("hymnal."),
    )[0];
    if (hymnal) {
      $modules.open(hymnal.split(".")[1]);
      return;
    }

    $appdata.set("modules.album.id_album", id_album);
    $appdata.set("modules.album.show", true);
    $appdata.set("modules.album.loading", false);
  },
  closeAlbum() {
    $dev.write("close album");
    $appdata.set("modules.album.show", false);

    $appdata.set("modules.album.data", {});
    $appdata.set("modules.album.id_album", null);
    $appdata.set("modules.album.loading", false);
  },

  async openAudio(params) {
    if (typeof params != "object") {
      params = { id_music: params };
    }
    $dev.write("open audio (minimized)", params);
    // Reproduz o áudio usando o player interno minimizado (rodapé) em vez de abrir
    // o arquivo diretamente no navegador. Mesmos controles e efeitos do player de slides,
    // porém sem exibir a janela de apresentação.
    await this.open({ id_music: params.id_music, mode: params.mode || "audio", minimized: true });
  },

  // Crossfade real entre músicas DIFERENTES — usado por open() quando já havia
  // áudio tocando (troca manual de faixa ou avanço da fila "Reproduzir todos").
  // Mesmo padrão de switchMode() (dois <audio>, xfade_in/xfade_out em paralelo,
  // 1200ms/40ms por passo), mas sem sincronizar currentTime (é uma música nova,
  // começa do zero) e sem tocar no elemento antigo antes deste ponto — quem chamou
  // (open()) já garantiu que ele seguiu tocando normalmente durante a busca
  // assíncrona da nova música.
  _crossfadeAudioTrack(url, targetVolume) {
    const oldAudio = this.getElement();

    const existing = document.getElementById("__audio_xfade");
    if (existing) { existing.pause(); existing.remove(); }

    const xfade = document.createElement("audio");
    xfade.id = "__audio_xfade";
    xfade.preload = "auto";
    xfade.volume = 0;
    xfade.src = url;
    document.body.appendChild(xfade);

    this._fadeKey = (this._fadeKey || 0) + 1;
    const xfadeKey = this._fadeKey;
    if (!this._fades) this._fades = {};
    clearInterval(this._fades.xfade_out);
    clearInterval(this._fades.xfade_in);
    $appdata.set("modules.media.config.is_fading", true);

    xfade.addEventListener("canplay", () => {
      if (this._fadeKey !== xfadeKey) {
        xfade.pause();
        xfade.src = "";
        xfade.remove();
        this._crossfading = false;
        $appdata.set("modules.media.config.is_fading", false);
        return;
      }

      xfade.currentTime = 0;
      xfade.play().catch(() => {});

      const FADE_MS = 1200;
      const INTERVAL = 40;
      const steps = Math.max(1, Math.round(FADE_MS / INTERVAL));

      // FADE OUT — música antiga sai enquanto a nova entra
      const outStart = oldAudio.volume;
      const outD = outStart / steps;
      let outN = 0;
      this._fades.xfade_out = setInterval(() => {
        if (this._fadeKey !== xfadeKey) { clearInterval(this._fades.xfade_out); return; }
        outN++;
        oldAudio.volume = Math.max(0, outStart - outD * outN);
        if (outN >= steps) {
          clearInterval(this._fades.xfade_out);
          oldAudio.pause();
          oldAudio.src = "";
          oldAudio.removeAttribute("id");
          oldAudio.remove();
        }
      }, INTERVAL);

      // FADE IN — promove xfade a elemento principal ao terminar
      const inD = targetVolume / steps;
      let inN = 0;
      this._fades.xfade_in = setInterval(() => {
        if (this._fadeKey !== xfadeKey) { clearInterval(this._fades.xfade_in); return; }
        inN++;
        xfade.volume = Math.min(targetVolume, inD * inN);
        if (inN >= steps) {
          clearInterval(this._fades.xfade_in);
          clearInterval(this._fades.xfade_out);

          xfade.id = "__audio";
          xfade.setAttribute("preload", "auto");
          xfade.setAttribute("autoplay", "true");
          xfade.addEventListener("timeupdate", this.timeUpdate.bind(this));
          xfade.addEventListener("progress", this.timeUpdate.bind(this));
          xfade.addEventListener("ended", this._onAudioEnded.bind(this));

          this._crossfading = false;
          $appdata.set("modules.media.config.is_paused", false);
          $appdata.set("modules.media.config.is_fading", false);
        }
      }, INTERVAL);
    }, { once: true });

    xfade.load();
  },

  _detachAndFadeOut() {
    const audio = this.getElement();
    if (!audio || audio.paused) return;
    const existing = document.getElementById("__audio_fadeout");
    if (existing) { existing.pause(); existing.remove(); }
    const ghost = document.createElement("audio");
    ghost.id = "__audio_fadeout";
    ghost.src = audio.src;
    ghost.currentTime = audio.currentTime;
    ghost.volume = audio.volume;
    document.body.appendChild(ghost);
    // Pausa a fonte imediatamente (stopAudio vai encontrá-la pausada e pular seu próprio fade)
    audio.pause();
    ghost.play().catch(() => {});
    const startVol = ghost.volume;
    const STEPS = Math.max(1, Math.round(900 / 40));
    const d = startVol / STEPS;
    let n = 0;
    const t = setInterval(() => {
      n++;
      ghost.volume = Math.max(0, startVol - d * n);
      if (n >= STEPS) {
        clearInterval(t);
        ghost.pause();
        ghost.src = "";
        ghost.remove();
      }
    }, 40);
  },

  // Cancela qualquer crossfade em andamento (switchMode() ou _crossfadeAudioTrack())
  // e limpa os elementos <audio> envolvidos. Sem isso, parar/fechar a mídia no meio
  // de um crossfade só pausava o elemento "__audio" antigo (que estava saindo) —
  // o elemento "__audio_xfade" (a faixa entrando) continuava tocando e seu
  // setInterval de fade-in seguia rodando até promovê-lo a "__audio" sozinho,
  // fazendo o áudio "reaparecer" tocando em segundo plano mesmo depois do usuário
  // ter mandado parar/fechar. keepMain=true preserva o elemento principal
  // "__audio" tocando (usado ao reabrir a mesma música: só o lixo da transição
  // anterior é limpo, a faixa atual continua até o novo crossfade assumir).
  _killCrossfade({ keepMain = false } = {}) {
    this._fadeKey = (this._fadeKey || 0) + 1;
    if (this._pauseInterval) { clearInterval(this._pauseInterval); this._pauseInterval = null; }
    if (this._fades) { clearInterval(this._fades.xfade_out); clearInterval(this._fades.xfade_in); }
    $appdata.set("modules.media.config.is_fading", false);

    const stray = document.getElementById("__audio_xfade");
    if (stray) { stray.pause(); stray.src = ""; stray.remove(); }
    const ghost = document.getElementById("__audio_fadeout");
    if (ghost) { ghost.pause(); ghost.src = ""; ghost.remove(); }

    if (!keepMain) {
      const main = document.getElementById("__audio");
      if (main) { main.pause(); main.setAttribute("src", ""); }
    }
  },

  // callback (opcional) só roda depois que o áudio de fato silenciou — com fade_audio
  // ligado, pause(true,...) só chama de volta ao FIM do fadeOutAudio (ver pause()),
  // não na hora. Quem fecha/oculta a projeção deve esperar por esse callback (ver
  // close()/endSong()) para não sumir a tela enquanto o áudio ainda está audível.
  stopAudio(callback) {
    // keepMain:true — só cancela um crossfade em andamento e limpa elementos órfãos
    // (__audio_xfade/__audio_fadeout); o elemento principal "__audio" É MANTIDO
    // tocando aqui. Se _killCrossfade() o pausasse antes da hora, o pause(true,...)
    // logo abaixo encontraria o áudio já parado e pularia o fade de verdade (bug:
    // stopAudio() virava sempre abrupto, mesmo com "Efeito de Fade" ligado).
    this._killCrossfade({ keepMain: true });
    const audio = this.getElement();
    this.pause(true, () => {
      audio.setAttribute("src", "");
      if (callback) callback();
    });
  },

  minimize() {
    // setMultiple: uma única mensagem IPC com os dois campos — mesmo motivo
    // do $modules.minimize() genérico (ver Modules.js). Com dois set()
    // separados, a janela de saída podia processá-los em momentos diferentes
    // e computar isActive (show || minimized) errado por um instante.
    $appdata.setMultiple([
      ["modules.media.minimized", true],
      ["modules.media.show", false],
    ]);
  },

  maximize() {
    // Atualiza o módulo ativo para a janela de saída junto — AppData.js
    // envia automaticamente para o output via IPC se ele estiver aberto; se
    // estiver fechado, a mensagem é ignorada sem efeito colateral.
    $appdata.setMultiple([
      ["modules.media.show", true],
      ["modules.media.minimized", false],
      ["popup_module", "media"],
    ]);
  },

  isMinimized() {
    return $appdata.get("modules.media.minimized", false);
  },

  isLoading() {
    return $appdata.get("modules.media.loading", false);
  },

  config() {
    return $appdata.get("modules.media.config");
  },

  slides(data) {
    data = data || $appdata.get("modules.media.data");

    let prev_image = data?.url_image;
    let prev_image_position = data?.image_position;

    return [
      {
        lyric: data?.name,
        cover: true,
        time: "00:00:00",
        instrumental_time: "00:00:00",
        url_image: data?.url_image,
        image_position: data?.image_position,
      },
      ...Object.values(data?.lyric || data?.slides || {})
        .filter((lyric) => !lyric.cover && lyric.show_slide !== 0 && lyric.show_slide !== false)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((lyric) => {
          if (lyric.url_image) {
            prev_image = lyric.url_image;
            prev_image_position = lyric.image_position;
          }
          return {
            ...lyric,
            cover: false,
            lyric: lyric.lyric ? lyric.lyric.replace(/[\r\n]+/g, "<br>") : "",
            url_image: prev_image,
            image_position: prev_image_position,
          };
        }),
    ];
  },

  slide() {
    let slides = this.slides() ?? [];
    let index = $appdata.get("modules.media.config.slide_index");
    return slides[index];
  },

  goToSlide(index) {
    const last_slide = $appdata.get("modules.media.config.last_slide");

    if (index > last_slide - 1) {
      index = last_slide - 1;
    }
    if (index < 0) {
      index = 0;
    }

    const duration = $appdata.get("modules.media.config.duration");
    const audio = $appdata.get("modules.media.config.audio");

    if (duration > 0 && audio != "") {
      const times = $appdata.get("modules.media.times");
      this.goToTime(times[index] || 0);
    } else {
      $appdata.set("modules.media.config.slide_index", index);
    }
  },
  goToTime(time) {
    const audio = this.getElement();
    const duration = $appdata.get("modules.media.config.duration");
    if (time == undefined || time < 0) {
      time = 0;
    } else if (time > duration) {
      time = duration;
    }
    audio.currentTime = time;
  },
  advanceTime(time = 10) {
    const duration = $appdata.get("modules.media.config.duration");
    const audio = $appdata.get("modules.media.config.audio");
    const current_time = $appdata.get("modules.media.config.current_time");

    if (duration > 0 && audio != "") {
      this.goToTime(current_time + time);
    }
  },

  play() {
    this.pause(false);
  },
  pause(bool = true, callback) {
    const audio = this.getElement();
    const fade_audio = $userdata.get("modules.media.fade_audio");

    if (bool) {
      if (fade_audio) {
        this.fadeOutAudio(() => {
          audio.pause();
          $appdata.set("modules.media.config.is_paused", bool);
          if (callback) callback();
        });
      } else {
        audio.pause();
        $appdata.set("modules.media.config.is_paused", bool);
        if (callback) callback();
      }
    } else {
      let self = this;
      audio.play().catch((e) => {
        // Modo "reproduzir todos": pula para a próxima faixa sem exibir alerta
        if (typeof self._autoCloseCallback === 'function') {
          self._autoCloseCallback();
          return;
        }
        const audioSrc = $appdata.get("modules.media.config.audio") || "";
        if (audioSrc.startsWith("app-local://") || audioSrc.startsWith("file://")) {
          $alert.show(
            {
              title: "modules.media.alerts.not_loaded_offline",
              text: "modules.media.alerts.not_loaded_offline_detail",
              color: "warning",
              translate: true,
              buttons: [
                { text: "alert.close", color: "grey", value: "close" },
                { text: "modules.media.alerts.btn_download", color: "primary", value: "download" },
              ],
            },
            function (val) {
              if (val === "download") {
                window.dispatchEvent(
                  new CustomEvent("open-download-center", {
                    detail: {
                      section: "collections",
                      id_album: $appdata.get("modules.media.id_album"),
                    },
                  })
                );
              }
            }
          );
        } else {
          $alert.error(
            { text: "modules.media.alerts.not_loaded", error: e || "" },
            function (a) {
              if (a) {
                self.open($appdata.get("modules.media.id_music"));
              }
            }
          );
        }
      });
      if (fade_audio) {
        this.fadeInAudio(() => {
          if (callback) callback();
        });
      } else {
        const volume = $appdata.get("modules.media.config.volume") / 100;
        audio.volume = volume;
        if (callback) callback();
      }
      $appdata.set("modules.media.config.is_paused", bool);
    }
  },

  fadeInAudio(callback) {
    const audio = this.getElement();
    $appdata.set("modules.media.config.is_fading", true);
    const max_volume = $appdata.get("modules.media.config.volume") / 100;

    // Cancela qualquer fade de pausa/play em andamento (não altera _fadeKey — pertence ao crossfade)
    if (this._pauseInterval) clearInterval(this._pauseInterval);
    const myCrossKey = this._fadeKey || 0;

    this._pauseInterval = setInterval(() => {
      if ((this._fadeKey || 0) !== myCrossKey) {
        clearInterval(this._pauseInterval); this._pauseInterval = null; return;
      }
      if (audio.volume < max_volume) {
        audio.volume = Math.min(audio.volume + 0.05, max_volume);
      } else {
        $appdata.set("modules.media.config.is_fading", false);
        clearInterval(this._pauseInterval); this._pauseInterval = null;
        if (callback) callback();
      }
    }, 60);
  },
  fadeOutAudio(callback) {
    const audio = this.getElement();

    if (audio.paused) {
      if (callback) callback();
      return;
    }

    $appdata.set("modules.media.config.is_fading", true);

    // Cancela qualquer fade de pausa/play em andamento (não altera _fadeKey — pertence ao crossfade)
    if (this._pauseInterval) clearInterval(this._pauseInterval);
    const myCrossKey = this._fadeKey || 0;

    this._pauseInterval = setInterval(() => {
      if ((this._fadeKey || 0) !== myCrossKey) {
        clearInterval(this._pauseInterval); this._pauseInterval = null; return;
      }
      if (audio.volume > 0) {
        audio.volume = Math.max(audio.volume - 0.05, 0);
      } else {
        $appdata.set("modules.media.config.is_fading", false);
        clearInterval(this._pauseInterval); this._pauseInterval = null;
        if (callback) callback();
      }
    }, 60);
  },

  firstSlide() {
    this.goToSlide(0);
  },
  prevSlide() {
    const slide_index = $appdata.get("modules.media.config.slide_index");
    this.goToSlide(slide_index - 1);
  },
  nextSlide() {
    const slide_index = $appdata.get("modules.media.config.slide_index");
    this.goToSlide(slide_index + 1);
  },
  lastSlide() {
    const last_slide = $appdata.get("modules.media.config.last_slide");
    this.goToSlide(last_slide - 1);
  },
  setVolume(val) {
    const audio = this.getElement();
    audio.volume = val / 100;
    $appdata.set("modules.media.config.volume", val);
  },
  toogleVolume() {
    let volume = $appdata.get("modules.media.config.volume");
    volume = volume < 100 ? 100 : 0;
    this.setVolume(volume);
  },

  fullscreen(value = true) {
    $appdata.set("modules.media.config.fullscreen", value);
  },

  // data/batch opcionais: quando open() já tem os dados carregados localmente
  // (ainda não gravados no store) e quer fundir subtitle/track/image num único
  // setMultiple maior, passa os dois; chamadas existentes sem eles continuam
  // lendo do store e aplicando via setMultiple próprio, como antes.
  setAlbumInfo(id_album, module = "media", data = null, batch = null) {
    data = data || $appdata.get(`modules.${module}.data`);

    const empty = () => ([
      [`modules.${module}.config.subtitle`, ""],
      [`modules.${module}.config.track`, 0],
      [`modules.${module}.config.image`, ""],
    ]);

    let entries;
    if (!data?.albums || data.albums.length <= 0) {
      entries = empty();
    } else {
      let album = null;
      if (id_album) {
        album = data.albums.filter((item) => item.id_album == id_album)[0];
      } else if (data.albums.length === 1) {
        album = data.albums[0];
      } else {
        album = data.albums.sort((a, b) => a.order - b.order)[0];
      }

      entries = !album ? empty() : [
        [`modules.${module}.config.subtitle`, album.name],
        [`modules.${module}.config.track`, album.track],
        [`modules.${module}.config.image`, album.url_image],
      ];
    }

    if (batch) {
      batch.push(...entries);
    } else {
      $appdata.setMultiple(entries);
    }
  },

  timeUpdate() {
    const duration_db =
      $appdata.get("modules.media.config.mode") == "audio"
        ? $appdata.get("modules.media.data.duration", "00:00")
        : $appdata.get("modules.media.data.instrumental_duration", "00:00");

    const audio = this.getElement();
    const current_time = isNaN(audio.currentTime) ? 0 : audio.currentTime;
    const duration =
      isNaN(audio.duration) || !isFinite(audio.duration)
        ? $datetime.toNumber(duration_db)
        : audio.duration;
    const progress = duration <= 0 ? 0 : (current_time / duration) * 100;
    let buffered = 0;

    $appdata.set("modules.media.config.current_time", current_time);
    $appdata.set("modules.media.config.duration", duration);
    $appdata.set("modules.media.config.progress", progress);

    if (!$appdata.get("modules.media.config.lazy")) {
      try {
        audio.buffered = 100;
      } catch (error) {
        //
      }
      buffered = 100;
    } else {
      buffered = 0;
      let audio_buffered = audio.buffered; // Obter intervalos de buffer carregados
      if (audio_buffered.length > 0) {
        buffered = (audio_buffered.end(0) / audio.duration) * 100;
      }
    }

    $appdata.set("modules.media.config.buffered", buffered);

    // Crossfade em andamento: o elemento lido acima (this.getElement()) ainda é a
    // faixa ANTIGA, só tocando para o fade-out — os dados/slide já são os da nova
    // música (trocados atomicamente em open()). Não recalcula slide_index a partir
    // do tempo da faixa antiga contra os `times` da faixa nova (índices não
    // corresponderiam). checkTime() também não roda: quem decide o próximo passo
    // durante um crossfade é o próprio open()/_crossfadeAudioTrack.
    if (this._crossfading) return;

    const times = $appdata.get("modules.media.times");

    const slide_index =
      times && times?.length
        ? times.filter((time) => time <= current_time).length - 1
        : 1;
    $appdata.set(
      "modules.media.config.slide_index",
      slide_index <= 0 ? 0 : slide_index,
    );

    const start_time = times && times?.length ? times[slide_index] : 0;
    const end_time =
      times && times?.length ? times[slide_index + 1] || duration : duration;
    const slide_progress =
      ((current_time - start_time) / (end_time - start_time)) * 100;
    $appdata.set("modules.media.config.slide_progress", slide_progress);

    this.checkTime();
  },
  // Segundos de antecedência para iniciar o avanço automático da fila (ver checkTime())
  // ANTES do fim real da faixa — é esse "respiro" que dá tempo do crossfade (1200ms)
  // rodar sobreposto ao finalzinho da música atual, em vez de esperar ela acabar.
  _PLAYALL_CROSSFADE_LEAD: 1.5,
  checkTime() {
    if (this._crossfading) return;

    const is_paused = $appdata.get("modules.media.config.is_paused");
    const current_time = $appdata.get("modules.media.config.current_time");
    const duration = $appdata.get("modules.media.config.duration");
    if (is_paused || duration <= 0) return;

    const hasQueueNext = typeof this._autoCloseCallback === 'function';
    const lead = hasQueueNext ? this._PLAYALL_CROSSFADE_LEAD : 0;
    if (current_time >= duration - lead) {
      if (hasQueueNext) {
        // Reprodução contínua ativa ("Reproduzir todos"): dispara a próxima faixa um
        // pouco antes do fim real para o crossfade se sobrepor ao finalzinho da atual.
        this._autoCloseCallback();
      } else {
        this.endSong();
      }
    }
  },
  _onAudioEnded() {
    // Crossfade em andamento: quem decide o próximo passo é o próprio
    // open()/_crossfadeAudioTrack — o elemento antigo só está tocando para o fade-out.
    if (this._crossfading) return;
    // Fallback para quando o último timeupdate não chegou a current_time >= duration
    // (comum em arquivos locais). Se checkTime() já processou o fim, is_paused estará
    // true (stopAudio define is_paused=true imediatamente) — evita duplo disparo.
    // Guarda adicional: duration é zerada no lote atômico de open() assim que a próxima
    // música é carregada (antes dela começar a tocar de fato); duration===0 aqui indica
    // que uma troca de faixa já está em andamento — não dispara de novo.
    if ($appdata.get("modules.media.config.is_paused")) return;
    if ($appdata.get("modules.media.config.duration") === 0) return;
    if (typeof this._autoCloseCallback === 'function') {
      this._autoCloseCallback();
    } else {
      this.endSong();
    }
  },
  getElement() {
    let el;
    let id = "__audio";
    if (!document.getElementById(id)) {
      el = document.createElement("audio");
      el.setAttribute("id", id);
      el.setAttribute("preload", "auto");
      document.body.appendChild(el);
      el.addEventListener("timeupdate", this.timeUpdate.bind(this));
      el.addEventListener("progress", this.timeUpdate.bind(this));
      el.addEventListener("ended", this._onAudioEnded.bind(this));
    } else {
      el = document.getElementById(id);
    }

    el.setAttribute("autoplay", true);
    return el;
  },

  // Precarrega uma imagem no cache do browser antes de exibir o slide.
  // Resolve na primeira conclusão (load, error ou timeout de 5s) sem jamais rejeitar.
  preloadImage(url) {
    if (!url) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      const t   = setTimeout(resolve, 5000);
      img.onload  = () => { clearTimeout(t); resolve(); };
      img.onerror = () => { clearTimeout(t); resolve(); };
      img.src = url;
    });
  },

  async resolveImageUrl(url) {
    if (!url) return '';
    // app-local:// é servido pelo protocolo privilegiado do Electron — sem bloqueio
    // do webSecurity. Retorna direto sem precisar de IPC adicional.
    if (url.startsWith('app-local://')) return url;
    // Tenta resolver para app-local:// via IPC (busca o arquivo no disco)
    if ($electron.isElectron()) {
      const local = await $electron.mediaResolveImage(url);
      if (local) return local;
    }
    if (url.startsWith('file://') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return $path.file(url);
  },

  async resolveDataImages(data) {
    if (!data) return;
    if (data.url_image) {
      data.url_image = await this.resolveImageUrl(data.url_image);
    }
    const slides = data.lyric || data.slides;
    if (slides) {
      for (const slide of Object.values(slides)) {
        if (slide.url_image) {
          slide.url_image = await this.resolveImageUrl(slide.url_image);
        }
      }
    }
    if (data.albums) {
      for (const album of data.albums) {
        if (album.url_image) {
          album.url_image = await this.resolveImageUrl(album.url_image);
        }
      }
    }
  },
};

// Outro dono de áudio (video_player, soundmaster) começou a tocar: se houver
// música ativa aqui, encerra com fade — mesmo efeito de "terminar a música".
$audioBus.listen("media", () => {
  const isPlayingAudio =
    !$appdata.get("modules.media.config.is_paused") &&
    ["audio", "instrumental"].includes($appdata.get("modules.media.config.mode"));
  if (isPlayingAudio) {
    Media.fadeOutAudio(() => Media.endSong());
  }
});

export default Media;
