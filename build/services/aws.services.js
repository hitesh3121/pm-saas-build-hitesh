import AWS from "aws-sdk";
import { settings } from "../config/settings.js";
export class AwsUploadService {
    static async uploadFileWithContent(fileName, fileContent, fileType) {
        AWS.config.update({
            accessKeyId: settings.awsBucketCredentials.accessKeyId,
            secretAccessKey: settings.awsBucketCredentials.secretAccessKey,
        });
        const bucketName = settings.awsBucketCredentials.bucketName;
        const params = {
            Bucket: `${bucketName}/${settings.environment}/${fileType}`,
            Key: fileName,
            Body: fileContent,
            contentType: "text/plain",
        };
        const s3 = new AWS.S3();
        return new Promise((resolve, reject) => {
            s3.upload(params, (err, data) => {
                if (err)
                    reject(err);
                resolve(data.Location);
            });
        });
    }
    // TODO: If Delete require on S3
    static async deleteFile(fileName, fileType) {
        AWS.config.update({
            accessKeyId: settings.awsBucketCredentials.accessKeyId,
            secretAccessKey: settings.awsBucketCredentials.secretAccessKey,
        });
        const bucketName = settings.awsBucketCredentials.bucketName;
        const params = {
            Bucket: `${bucketName}/${settings.environment}/${fileType}`,
            Key: fileName,
        };
        const s3 = new AWS.S3();
        return new Promise((resolve, reject) => {
            s3.deleteObject(params, (err) => {
                if (err)
                    reject(err);
                resolve();
            });
        });
    }
}
