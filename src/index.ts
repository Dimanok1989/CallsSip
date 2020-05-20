import './style.css'; // Основной файл стилей
import { SimpleUser, SimpleUserOptions } from "sip.js/lib/platform/web"; // Библиотека SIP.js
import $ from "jquery";

import '@fortawesome/fontawesome-free/js/all.js';


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
                    .addClass('call-sip-calling')
                    .html('<i class="fas fa-phone fa-lg"></i>');

                $('#call-sip-status').text('Соединение установлено');

                $('#call-sip-display #call-sip-off').prop('disabled', false);
                $('#call-sip-display #call-sip-on').prop('disabled', true);

                this.stopAudio();
                
            },

            // Звонок прекращен
            onCallHangup: () => {

                $('#calls-sip')
                    .removeClass('call-sip-calling call-sip-received call-sip-ring')
                    .html('<i class="fas fa-phone fa-lg fa-rotate-270"></i>');

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

        $('#calls-sip').attr('class', 'calls-sip-btn').html('<i class="fas fa-phone fa-lg fa-rotate-270"></i>');

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
        console.log(data);

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
            <i class="fas fa-phone fa-lg fa-rotate-270"></i>
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
                    <i class="fas fa-phone-alt"></i>
                </button>
                <button type="button" id="call-sip-off" class="btn-sip-danger" disabled onclick="__sipjs.sip.simpleUser.hangup();">
                    <i class="fas fa-phone-slash"></i>
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

}

declare var __sipjs: any;
const callsSip = new CallsSip(__sipjs);
__sipjs.sip = callsSip;

callsSip.init();