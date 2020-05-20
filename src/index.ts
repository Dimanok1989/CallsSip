import './style.css'; // Основной файл стилей
import { SimpleUser, SimpleUserOptions } from "sip.js/lib/platform/web"; // Библиотека SIP.js
import $ from "jquery";


class CallsSip {

    // Стандартные настройки плагина
    options: any = {
        title: "Calls-Sip",
        position: "right bottom",
        audio: true,
        rings: {
            answered: "./../public/sounds/answered.mp3",
            rejected: "./../public/sounds/rejected.mp3",
            ringback: "./../public/sounds/ringback.mp3",
            ringing: "./../public/sounds/ringing.ogg",
        },
    };

    ws: string; // WSS Адрес сервера
    server: string; // Адрес SIP сервера
    authorizationUsername: string; // Логин пользователя
    authorizationPassword: string; // Пароль пользователя
    aor: string; // SIP Адрес записи

    simpleUser: any;

    audio: any;

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

        if (!this.ws || !server || !authorizationUsername || !authorizationPassword)
            return false;

        const el = this.getAudioElement("remoteAudio");

        this.createHtmlElements();

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

        // Перед подключением к серверу и регистрации, иконка окрашивается
        // в красный цвет, чтобы показать неудачное подключение
        $('#calls-sip').addClass('calls-sip-bad-connect');

        // Подключение к серверу
        await this.simpleUser.connect();

        // Регистрация на сервере
        await this.simpleUser.register();

        // Обработка событий
        this.simpleUser.delegate = {

            // Пользователь зарегитсрирован
            onRegistered: async () => {
                $('#calls-sip').removeClass('calls-sip-bad-connect').addClass('calls-sip-register');
                $('#calls-sip').on('click', this.openPhoneDisplay);
                $('#call-sip-display .call-sip-close').on('click', this.closePhoneDisplay);
            },

            // Отмена регистрации
            onUnregistered: () => {
                this.stopCallsSip();
            },

            // Отключен от сервера
            onServerDisconnect: (error: any) => {
                this.stopCallsSip(error);
            },

            // Входящий звонок
            onCallReceived: async () => {

                let ev: any = event;
                let data: any = ev.data;
                data = data.split("\n");
                let inNum: string = this.searchFromNumber(data);

                $('#call-sip-display #call-sip-off').prop('disabled', false);

                $('#call-sip-screen').val(inNum);
                $('#call-sip-status').text('Входящий звонок...');

                this.playAudio(this.options.rings.ringing, true);
                this.animateCallStart();

                $(document).on("keydown", this.disableUpdate);

                $('#call-sip-display #call-sip-on').prop('disabled', false)
                .on('click', () => {

                    this.stopAudio();
                    this.animateCallStop();

                    $('#call-sip-status').text('Соединение...');
                    $('#call-sip-display #call-sip-on').prop('disabled', true);
                    this.simpleUser.answer();

                });

            },

            // Разговор начался
            onCallAnswered: () => {

                $('#calls-sip')
                    .removeClass('call-sip-received call-sip-ring')
                    .addClass('call-sip-calling');

                $('#call-sip-status').text('Соединение установлено');

                $('#call-sip-display #call-sip-off').prop('disabled', false);
                $('#call-sip-display #call-sip-on').prop('disabled', true);

                this.stopAudio();
                
            },

            // Звонок прекращен
            onCallHangup: () => {

                $('#calls-sip').removeClass('call-sip-calling call-sip-received call-sip-ring');

                $('#call-sip-screen').val('');
                $('#call-sip-status').text('Завершено');

                setTimeout(() => {
                    let text = $('#call-sip-status').text();
                    if (text == "Завершено")
                        $('#call-sip-status').text('Готов');
                }, 2000);

                $('#call-sip-display #call-sip-off').prop('disabled', true);
                $('#call-sip-display #call-sip-on').prop('disabled', true);

                this.playAudio(this.options.rings.answered);
                this.animateCallStop();
                $(document).off("keydown", this.disableUpdate);

            },

        };

    }

    stopCallsSip(error: string = "") {

        $('#calls-sip').off('click');
        $('#call-sip-display .call-sip-close').off('click');

        $('#calls-sip').attr('class', 'calls-sip-btn');

        this.closePhoneDisplay();

    } 

    /**
     * Метод исходящего звонка
     * 
     * @param number Номер вызова 
     */
    async call(number: string) {

        let destination = "sip:" + number + "@" + this.server;
        $('#call-sip-screen').val(number);

        $('#call-sip-status').text('Соединение...');
        this.playAudio(this.options.rings.ringback, true);

        $('#call-sip-display #call-sip-off').prop('disabled', false);
        this.openPhoneDisplay();

        $(document).on("keydown", this.disableUpdate);

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

    /**
     * Метод полиска входящего номера
     */
    searchFromNumber(data: any) {

        let number = "Неизвестно";

        if ($.isArray(data)) {
            data.forEach((elem: any) => {

                if (elem.indexOf('From: "') >= 0) {
                    elem = String(elem).replace('From: "', '').split('" <');
                    number = elem[0];
                    console.log(number);
                }

            });
        }

        return number;

    }

    /**
     * Метод создания элемента звонилки
     */
    createHtmlElements() {

        $('body').append(`<div id="calls-sip" class="calls-sip-btn">
            <div>${this.getIcon()}</div>
        </div>
        <div id="call-sip-display" class="call-sip-display">
            <div class="call-sip-display-header">
                <div class="call-sip-title">${this.options.title}</div>
                <span class="call-sip-close">&times;</span>
            </div>
            <div class="call-sip-screen">
                <div id="call-sip-status" class="call-sip-status">Готов</div>
                <input type="text" id="call-sip-screen" value="" disabled>
            </div>
            <div class="call-sip-display-footer">
                <button type="button" id="call-sip-on" class="btn-sip-success" disabled>
                    ${this.getIcon("start")}
                </button>
                <button type="button" id="call-sip-off" class="btn-sip-danger" disabled onclick="__sipjs.sip.simpleUser.hangup();">
                    ${this.getIcon("end")}
                </div>
            </div>
        </div>`);

    }

    /**
     * Открытие экрана звонка
     */
    openPhoneDisplay() {

        $('#call-sip-display').show().animate({
            right: "15px",
        }, 50);

    }

    /**
     * Закрытие экрана звонка
     */
    closePhoneDisplay() {

        $('#call-sip-display').animate({
            right: "-245px",
        }, 50).hide(60);

    }

    /**
     * Воспроизведение звуковых эффектов
     */
    playAudio(ring: string = "", loop = false) {

        this.stopAudio();

        if (!this.options.audio || ring == "")
            return false;

        this.audio = new Audio(ring);

        // Повторяющееся воспроизведение
        if (loop)
            this.audio.loop = true;        
        
        this.audio.play();

    }

    stopAudio() {

        if (this.audio) {
            this.audio.pause();
            this.audio = false;
        }

    }

    animateCall: any;
    animateCallStep: boolean = false;

    pageTitle: string = "";

    /**
     * Метод анимации кнопки плагина
     */
    animateCallStart() {

        this.animateCall = setInterval(this.animateCallSteps, 1000);

    }

    
    animateCallSteps() {

        if (this.pageTitle == "")
            this.pageTitle = $('head title').text();

        if (this.animateCallStep) {
            $('#calls-sip').addClass('call-sip-ring');
            // $('head title').text('ЗВОНОК - ' + this.pageTitle);
        }
        else {
            // $('head title').text(this.pageTitle);
            $('#calls-sip').removeClass('call-sip-ring');
        }

        this.animateCallStep = !this.animateCallStep;

    }

    animateCallStop() {
        clearInterval(this.animateCall);
        $('#calls-sip').removeClass('call-sip-ring');
        // $('head title').text(this.pageTitle);
    }
    
    /**
     * Метод проверки обновления страницы
     */
    disableUpdate(event: any) {

        if ((event.which || event.keyCode) == 116 || (event.which || event.keyCode) == 82)
            event.preventDefault();

        var isUpdate = confirm("Вы не завершили разговор, если обновить страницу, звонок будет прерван! Нажмите ОК, чтобы обновсить страницу");

        if (isUpdate)
            location.reload();

    }
    
    getIcon(type: string = "") {

        let icon = "";

        switch (type) {

            case "start":
                icon = `<svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" data-fa-i2svg=""><path fill="currentColor" d="M497.39 361.8l-112-48a24 24 0 0 0-28 6.9l-49.6 60.6A370.66 370.66 0 0 1 130.6 204.11l60.6-49.6a23.94 23.94 0 0 0 6.9-28l-48-112A24.16 24.16 0 0 0 122.6.61l-104 24A24 24 0 0 0 0 48c0 256.5 207.9 464 464 464a24 24 0 0 0 23.4-18.6l24-104a24.29 24.29 0 0 0-14.01-27.6z"></path></svg>`;
                break;

            case "end":
                icon = `<svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" data-fa-i2svg=""><path fill="currentColor" d="M268.2 381.4l-49.6-60.6c-6.8-8.3-18.2-11.1-28-6.9l-112 48c-10.7 4.6-16.5 16.1-13.9 27.5l24 104c2.5 10.8 12.1 18.6 23.4 18.6 100.7 0 193.7-32.4 269.7-86.9l-80-61.8c-10.9 6.5-22.1 12.7-33.6 18.1zm365.6 76.7L475.1 335.5C537.9 256.4 576 156.9 576 48c0-11.2-7.7-20.9-18.6-23.4l-104-24c-11.3-2.6-22.9 3.3-27.5 13.9l-48 112c-4.2 9.8-1.4 21.3 6.9 28l60.6 49.6c-12.2 26.1-27.9 50.3-46 72.8L45.5 3.4C38.5-2 28.5-.8 23 6.2L3.4 31.4c-5.4 7-4.2 17 2.8 22.4l588.4 454.7c7 5.4 17 4.2 22.5-2.8l19.6-25.3c5.4-6.8 4.1-16.9-2.9-22.3z"></path></svg>`;
                break;
        
            default:
                icon = `<svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" data-fa-i2svg=""><path fill="currentColor" d="M493.4 24.6l-104-24c-11.3-2.6-22.9 3.3-27.5 13.9l-48 112c-4.2 9.8-1.4 21.3 6.9 28l60.6 49.6c-36 76.7-98.9 140.5-177.2 177.2l-49.6-60.6c-6.8-8.3-18.2-11.1-28-6.9l-112 48C3.9 366.5-2 378.1.6 389.4l24 104C27.1 504.2 36.7 512 48 512c256.1 0 464-207.5 464-464 0-11.2-7.7-20.9-18.6-23.4z"></path></svg>`;
                break;

        }

        return icon;

    }

}

declare var __sipjs: any;
const callsSip = new CallsSip(__sipjs);
__sipjs.sip = callsSip;

callsSip.init();