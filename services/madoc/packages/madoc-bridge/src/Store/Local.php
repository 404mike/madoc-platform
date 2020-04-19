<?php

namespace MadocBridge\Store;

use Doctrine\DBAL\Connection;
use Omeka\File\Store\StoreInterface;
use Omeka\File\Store\Local as BaseLocal;
use Zend\Log\Logger;

/**
 * Local filesystem file store
 */
class Local extends BaseLocal implements StoreInterface
{

    /**
     * @var Connection
     */
    private $connection;

    public function __construct(Connection $connection, $basePath, $baseUri, Logger $logger)
    {
        $this->connection = $connection;
        parent::__construct($basePath, $baseUri, $logger);
    }

    public function getUri($storagePath)
    {
        $didMatch = preg_match('/(original|large|square)\/virtual\/(.*)\.(.*)/', $storagePath, $matches);
        if ($didMatch) {
            $hash = $matches[2];
            $query = $this->connection->prepare('SELECT source FROM media WHERE storage_id = :storageId');
            $query->bindValue('storageId', "virtual/$hash");
            $query->execute();
            $result = $query->fetch();

            return $result['source'];
        }

        return sprintf('%s/%s', $this->baseUri, $storagePath);
    }

    public function delete($storagePath)
    {
        $didMatch = preg_match('/(original|large|square)\/virtual\/(.*)\.(.*)/', $storagePath, $matches);
        if ($didMatch) {
            return;
        }
        parent::delete($storagePath);
    }

}
