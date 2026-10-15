import { KafkaConnector, Publisher } from "@mss/common";

class AuthKafkaConnecter extends KafkaConnector {

  publisher: Publisher<any>;

  constructor() {
    super();
  }

  onConnected() {
    this.logger.info("Connected to Kafka");
    this.initPublisher();
    this.initListener();
  }

  connect(brokers: string[]) {
    this.connectKafka(brokers);
  }

  async disconnect() { }

  initPublisher() {
    this.publisher = new Publisher(this.client, {});
  }

  initListener() { }
}

export const kafkaConnector = new AuthKafkaConnecter();
