// cd ext_www/lk.skillline.ru/local/pm2_scripts/medreg39/
// DEBUG=nightmare:*,electron:* node index.js
// https://linux2you.com/nightmare-js-with-docker/
// https://stackoverflow.com/questions/44879567/nightmarejs-runs-forever
// nvm use 18
// pm2 start app --cron-restart="0 * * * *"

const request = require('./request.js');
const Nightmare = require('nightmare');
const {writeFile} = require('fs');


class Crawler
{
    baseUrl = 'https://medreg.gov39.ru/';
    userAgent = 'Mozilla/20.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

    police = 3954500818000126;
    doctorType = 'Врач-стоматолог';
    doctorName = 'Иляшевич';

    writeLog = true;
    debug = false;
    restartDelayMs = 5000;

    telegramApiBaseUrl = 'https://api.telegram.org';
    tgBotApiKey = '6544147089:AAGlQWMw6gEyi5FDiM-NCyyCWSgN5T8Z55A';
    telegramChatId = 377220300;

    async run() {
        const nightmare = Nightmare({
            show: true,
            width: 1600,
            height: 900,
            openDevTools: {
                mode: 'attach'
            }
        });

        await this.log(`Заходим на сайт "${this.baseUrl}"`);
        await nightmare.goto(this.baseUrl, {
            'User-Agent': this.userAgent,
        });

        // Попытаться, продолжить
        await this.log(`Кликаем на кнопку "Попытаться, продолжить"`);
        await nightmare.click('#D3_NOT_SUPPORTED_NEXT');
        await nightmare.wait(500)

        // Записаться на приём
        await this.log(`Кликаем на кнопку "Записаться на приём"`);
        await nightmare.click('.er-button__top-line-main')
        await nightmare.wait(500)

        // Ввод страхового полиса
        await this.log(`Вводим страховой полис "${this.police}"`);
        await nightmare.evaluate(function(police){
            const input = document.querySelector('div[name="polis_num__ls"] input');
            input.value = police;
            input.dispatchEvent(new Event('input'));
        }, this.police)
        await nightmare.wait(1000)

        // Нажатие кнопки "Продолжить"
        await this.log(`Кликаем на кнопку "Продолжить"`);
        await nightmare.click('button[name="erLoginSchemeButtonEnter"')
        await nightmare.wait(3000)

        // Поиск специальности врача
        await this.log(`Ищем специальность "${this.doctorType}" по точному совпадению`);
        await nightmare.evaluate(function(speciality) {
            const buttons = document.querySelectorAll('button')
            buttons.forEach(button => {
                if(button.innerText === speciality) {
                    button.click();
                }
            });
        }, this.doctorType);
        await nightmare.wait(1000);

        // Выбор нужного врача
        await this.log(`Ищем врача "${this.doctorName}"`);
        const isDoctorFound = await nightmare.evaluate(function(name) {
            const wrapperList = document.querySelectorAll('.er-big-container');
            for(const wrapper of wrapperList) {
                const spanList = wrapper.querySelectorAll('span');
                for(const span of spanList) {
                    if(span.textContent.includes(name)) {
                        span.click()
                        return true;
                    }
                }
            }

            return false;
        }, this.doctorName);
        await nightmare.wait(1000);

        if(!isDoctorFound) {
            console.log(`Врач "${this.doctorName}" не найден`);
            await this.end(nightmare);
            return;
        }

        // Удаление попапов, выбор дня записи
        await this.log(`Ищем свободную для записи дату`);
        let day = await nightmare.evaluate(function() {
            const popupShitList = document.querySelectorAll('div[name="erMessageAllowWaitList"]');
            popupShitList.forEach(popup => popup.remove());

            const exampleTable = document.querySelectorAll('.er-userforms39__time');
            exampleTable.forEach(table => table.remove());

            const calendarWrapper = document.querySelector('div[name="er-content-time-left"]');
            if(!calendarWrapper) {
                return;
            }

            let allowedDateButtons = calendarWrapper.querySelectorAll('button.er-button__time_active_free');
            if(allowedDateButtons.length !== 0) {
                const date = allowedDateButtons[0];
                date.click();

                return date.innerText;
            }

            const nextMonthButtonList = document.querySelectorAll('button[name="btnRightMonth"]');
            for(const button of nextMonthButtonList) {
                button.click();
            }

            allowedDateButtons = calendarWrapper.querySelectorAll('button.er-button__time_active_free');
            if(allowedDateButtons.length !== 0) {
                const date = allowedDateButtons[0];
                date.click();

                return date.innerText;
            }
        });
        await nightmare.wait(500)

        if(!day) {
            await this.log('Нет свободного дня для записи :(');
            // await this.sendTgMessage(`Нет свободного дня для записи у "${this.doctorType}" - "${this.doctorName}"`);
            await this.end(nightmare);
            return;
        }

        // Выбор времени записи
        await this.log(`Ищем свободное для записи время`);
        const time = await nightmare.evaluate(function() {
            const timeWrapper = document.querySelector('div[name="er-content-time-right"]');
            if(!timeWrapper) {
                return;
            }

            const timeItemsWrapper = timeWrapper.querySelector('.er-date-time');
            if(!timeItemsWrapper) {
                return;
            }

            const freeTimeButtons = timeItemsWrapper.querySelectorAll('.er-button__time:not(.er-button__time_occupied)');
            if(freeTimeButtons.length !== 0) {
                const timeButton = freeTimeButtons[0];
                timeButton.click();

                // Время записи
                return timeButton.innerText;
            }
        })
        await nightmare.wait(1000)
        if(!time) {
            await this.log(`Нет свободного времени для записи на ${day} число :(`);
            await this.end(nightmare);
            return;
        }

        // Нажатие кнопки "Записаться"
        await this.log(`Кликаем на кнопку "Записаться"`);
        const success = await nightmare.evaluate(function() {
            const buttons = document.querySelectorAll('button');
            for(const button of buttons) {
                if(button.innerText === 'Записаться') {
                    button.click();
                    return true;
                }
            }

            return false;
        });

        if(success) {
            const now = new Date();
            let month = now.getMonth() + 1;
            if(month < 10) {
                month = `0${month}`;
            }
            if(Number(day) < 10) {
                day = `0${day}`;
            }

            const message = `Получилось записаться к "${this.doctorType}" - "${this.doctorName}" на ${day}.${month} в ${time}!`;
            await this.log(message);
            await this.sendTgMessage(message);
        } else {
            await this.log(`Почему-то не получилось записаться на ${day} в ${time}`);
        }

        await this.end(nightmare);
    }

    async end(instance) {
        await instance.end();

        const path = require('path');
        const scriptName = path.basename(__filename);

        await new Promise(resolve => setTimeout(resolve, this.restartDelayMs));

        const nrc = require('node-run-cmd');
        await nrc.run(`node ${scriptName}`);
    }

    async log(message) {
        if(this.writeLog) {
            console.log(message);
            // const now = (new Date).toLocaleTimeString();
            // await writeFile('./logs.txt', `[${now}]: ${message}\n`, () => {});
        }
    }

    /**
     * Отправка уведомления через телеграм бота
     */
    async sendTgMessage(message) {
        try {
            await request.post(`${this.telegramApiBaseUrl}/bot${this.tgBotApiKey}/sendMessage`, {
                'chat_id': this.telegramChatId,
                'text': message
            });
        } catch(e) {
            await this.log('Не получилось отправить уведомление в телеграм', e);
        }
    }
}

const crawler = new Crawler();
crawler.run();
// (async() => {
//     await crawler.run();
// })();
