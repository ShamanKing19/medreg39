class Request
{
    UserAgent = require('user-agents');
    axios = require('axios');

    /**
     * GET запрос с параметрами и стандартным таймаутом
     *
     * @param {string} url Ссылка
     * @param {Object} config Конфиг
     *
     * @returns {AxiosResponse<any>}
     */
    async get(url, config = {}) {
        const instance = this.axios.create();
        if(!('timeout' in config)) {
            config['timeout'] = 3000;
        }
        if(!('headers' in config)) {
            config['headers'] = {};
            if(!('User-agent' in config['headers'])) {
                config['headers'] = {
                    'User-agent': this.getUserAgent(),
                };
            }
        }
        return await instance.get(encodeURI(url), config);
    }

    /**
     * POST запрос с параметрами и стандартным таймаутом
     *
     * @param {string} url Ссылка
     * @param {Object} data Тело запроса
     * @param {Object} config Конфиг
     *
     * @returns {AxiosResponse<any>}
     */
    async post(url, data, config = {}) {
        const instance = this.axios.create();
        if(!('timeout' in config)) {
            config['timeout'] = 3000;
        }
        if(!('headers' in config)) {
            config['headers'] = {
                'User-agent': this.getUserAgent(),
            };
        }

        return await instance.post(encodeURI(url), data, config);
    }

    /**
     * Останавливает программу
     *
     * @param {Number} ms Количество миллисекунд
     */
    async sleep(ms) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Генерирует случайный User-agent
     *
     * @returns {string}
     */
    getUserAgent() {
        return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';
        return new this.UserAgent().toString();
    }
}

module.exports = new Request();