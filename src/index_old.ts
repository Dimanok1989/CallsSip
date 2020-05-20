import './style.css'; // Основной файл стилей
import { SimpleUser, SimpleUserOptions } from "sip.js/lib/platform/web"; // Библиотека SIP.js
import $ from "jquery";


class CallsSip {

    ws: string; // WSS Адрес сервера
    server: string; // Адрес SIP сервера
    authorizationUsername: string; // Логин пользователя
    authorizationPassword: string; // Пароль пользователя
    aor: string; // SIP Адрес записи

    simpleUser: any = {};

    constructor(config: any) {

        this.ws = config.ws || false;
        this.server = config.server || false;
        this.authorizationUsername = config.authorizationUsername || false;
        this.authorizationPassword = config.authorizationPassword || false;

        this.aor = `sip:${this.authorizationUsername}@${this.server}`;

    }

    /**
     * Инициализация настроек и подключение к серверу
     */
    async init() {

        const server = this.ws;
        const aor = this.aor;
        const authorizationUsername = this.authorizationUsername;
        const authorizationPassword = this.authorizationPassword;

        const el = this.getAudioElement("remoteAudio");

        let options: SimpleUserOptions = {
            aor,
            media: {
                remote: {
                    audio: el,
                }
            },
            userAgentOptions: {
                authorizationPassword,
                authorizationUsername,
            }
        }

        // Создание экземпляра SimpleUser
        this.simpleUser = new SimpleUser(server, options);

        // Подключение к серверу
        await this.simpleUser.connect();

        // Регистрация на сервере
        await this.simpleUser.register();

        // Вывод входящего звонка
        this.simpleUser.delegate = {
            onCallReceived: async () => {
                // await simpleUser.answer();
            }
        };

        // this.simpleUser.userAgent.start();

        // this.simpleUser.userAgent.delegate = {
        //     onConnect: () => {
        //         console.log('Connected');
        //     }
        // }
    
        // setTimeout(() => {
        //     this.call("1002");
        // }, 1000);

    }

    /**
     * Метод исходящего звонка
     * 
     * @param number Номер вызова 
     */
    async call(number: string) {

        let destination = "sip:" + number + "@" + this.server;
        $('body').append(`<div id="calling-to">Вызываем: ${number}</div>`);

        await this.simpleUser.call(destination);

    }

    /**
     * Метод проверки html аудио элемента
     */
    getAudioElement(id: string): HTMLAudioElement {

        if (!$('#remoteAudio').length)
            $('body').append('<audio id="remoteAudio"></audio>')

        $('#remoteAudio').css('display', 'none');

        const el = document.getElementById(id);
        if (!(el instanceof HTMLAudioElement))
            throw new Error(`Element "${id}" not found or not an audio element.`);

        return el;

    }

}

declare var __sipjs: any;
const callsSip = new CallsSip(__sipjs);
__sipjs.sip = callsSip;

callsSip.init();