import { settings } from "../config/settings.js";
export class BrevoService {
    static apiKey = settings.brevoApiKey;
    static listId = 79;
    static baseURL = "https://api.brevo.com/v3/contacts";
    static headers = {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": this.apiKey,
    };
    static async createOrUpdateContact(email, firstName, lastName) {
        try {
            const userExistOrNot = await fetch(`${this.baseURL}/${email}`, {
                method: "GET",
                headers: this.headers,
            });
            // const userData = await userExistOrNot.json();
            if (userExistOrNot.status === 404) {
                try {
                    const createUser = await fetch(this.baseURL, {
                        method: "POST",
                        headers: this.headers,
                        body: JSON.stringify({
                            updateEnabled: false,
                            email,
                            attributes: { FIRSTNAME: firstName, LASTNAME: lastName },
                            listIds: [this.listId],
                        }),
                    });
                    // const data = await createUser.json();
                }
                catch (error) {
                    console.error(error);
                }
            }
            else {
                try {
                    const updateUser = await fetch(`${this.baseURL}/${email}`, {
                        method: "PUT",
                        headers: this.headers,
                        body: JSON.stringify({
                            attributes: {
                                EMAIL: email,
                                FIRSTNAME: firstName,
                                LASTNAME: lastName,
                            },
                            listIds: [this.listId],
                        }),
                    });
                    // const data = await updateUser.json();
                }
                catch (error) {
                    console.error(error);
                }
            }
        }
        catch (error) {
            console.error(error);
        }
    }
}
