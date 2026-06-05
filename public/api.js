const http = {
    get:    url       => fetch(url, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw r; return r.json(); }),
    post:   (url, b)  => fetch(url, { credentials: 'same-origin', method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }),
    put:    (url, b)  => fetch(url, { credentials: 'same-origin', method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }),
    delete: url       => fetch(url, { credentials: 'same-origin', method: 'DELETE' }),
};
