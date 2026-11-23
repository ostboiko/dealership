# АвтоСалон — REST API + HTML/CSS/JS

## Запуск
Потрібен Node.js 18+ (залежності не потрібні).

    npm start
    # відкрийте http://localhost:3000

Інший порт: `PORT=8080 npm start`

## Структура
    server.js        — REST API + роздача статичних файлів
    data/cars.json   — база (створюється автоматично)
    public/          — фронтенд (index.html, style.css, script.js)

## Ендпоінти
| Метод  | URL                 | Опис                                              | Відповідь |
|--------|---------------------|---------------------------------------------------|-----------|
| GET    | /api/health         | перевірка сервера                                 | 200 |
| GET    | /api/cars           | список; `?q=` пошук, `?sort=new/priceAsc/priceDesc/yearDesc/mileageAsc` | 200 `{items,total}` |
| GET    | /api/cars/:id       | одне авто                                         | 200 / 404 |
| POST   | /api/cars           | додати авто (JSON)                                | 201 / 422 |
| DELETE | /api/cars/:id       | видалити авто                                     | 204 / 404 |
| GET    | /api/stats          | статистика каталогу                               | 200 |
| POST   | /api/reset          | початковий список                                 | 200 |

Приклад:

    curl -X POST http://localhost:3000/api/cars -H "Content-Type: application/json" \
      -d '{"brand":"Audi","model":"A6","year":2018,"price":23000,"mileage":90,"fuel":"Дизель","gearbox":"Автомат"}'

Помилки мають вигляд `{"error":{"message":"...","fields":{"year":"..."}}}`.
# dealership
